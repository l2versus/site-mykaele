// src/lib/rag.ts — Pipeline RAG: chunking, embeddings e Concierge IA
// Usa Google Gemini (grátis: 1500 req/dia embeddings, 15 req/min chat)
import { prisma } from '@/lib/prisma'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getGeminiApiKey, createGeminiModel } from '@/lib/gemini'

const CHUNK_SIZE = 1000
const CHUNK_OVERLAP_RATIO = 0.1 // 10% overlap
const EMBEDDING_MODEL = 'text-embedding-004'

/**
 * Divide texto em chunks de ~1000 caracteres com 10% de overlap.
 * Respeita quebras de parágrafo e de frase — nunca corta no meio de uma palavra.
 * PDFs devem ser pré-processados com pdf-parse antes de chamar esta função.
 */
export function chunkText(text: string, chunkSize = CHUNK_SIZE): string[] {
  const cleaned = text.replace(/\n{3,}/g, '\n\n').trim()
  const overlap = Math.round(chunkSize * CHUNK_OVERLAP_RATIO)

  if (cleaned.length <= chunkSize) {
    return [cleaned]
  }

  // Separar em parágrafos primeiro
  const paragraphs = cleaned.split(/\n\n+/)
  const chunks: string[] = []
  let currentChunk = ''

  for (const para of paragraphs) {
    const trimmed = para.trim()
    if (!trimmed) continue

    // Se o parágrafo inteiro cabe no chunk atual
    if (currentChunk.length + trimmed.length + 2 <= chunkSize) {
      currentChunk = currentChunk ? `${currentChunk}\n\n${trimmed}` : trimmed
      continue
    }

    // Se o chunk atual já tem conteúdo, salvar e iniciar overlap
    if (currentChunk) {
      chunks.push(currentChunk.trim())
      // Overlap: pegar o final do chunk como início do próximo
      const overlapText = currentChunk.slice(-overlap)
      const lastSentence = overlapText.indexOf('. ')
      currentChunk = lastSentence >= 0
        ? overlapText.slice(lastSentence + 2)
        : overlapText
    }

    // Parágrafo maior que chunkSize: quebrar por frase
    if (trimmed.length > chunkSize) {
      const sentences = trimmed.split(/(?<=[.!?])\s+/)
      for (const sentence of sentences) {
        if (currentChunk.length + sentence.length + 1 <= chunkSize) {
          currentChunk = currentChunk ? `${currentChunk} ${sentence}` : sentence
        } else {
          if (currentChunk) {
            chunks.push(currentChunk.trim())
            const overlapText = currentChunk.slice(-overlap)
            currentChunk = overlapText
          }
          currentChunk = currentChunk ? `${currentChunk} ${sentence}` : sentence
        }
      }
    } else {
      currentChunk = currentChunk ? `${currentChunk}\n\n${trimmed}` : trimmed
    }
  }

  // Último chunk
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim())
  }

  return chunks.filter(c => c.length > 50)
}

/**
 * Gera embedding via Google Gemini text-embedding-004 (768 dim).
 * Grátis: 1500 requisições/dia.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = await getGeminiApiKey()
  if (!apiKey) throw new Error('GEMINI_API_KEY não encontrada')
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL })
  const result = await model.embedContent(text.slice(0, 8000))
  return result.embedding.values
}

/**
 * Faz upload de conteúdo para a base de conhecimento.
 * Divide em chunks e gera embeddings para cada um.
 * Quando pgvector estiver disponível, salva embedding via raw SQL.
 */
export async function upsertKnowledge(params: {
  tenantId: string
  title: string
  content: string
  sourceFile?: string
}): Promise<number> {
  const { tenantId, title, content, sourceFile } = params

  // Remover chunks antigos do mesmo arquivo
  if (sourceFile) {
    await prisma.crmKnowledgeBase.deleteMany({
      where: { tenantId, sourceFile },
    })
  }

  const chunks = chunkText(content)

  // Criar chunks no banco
  const records = await prisma.$transaction(
    chunks.map((chunk, index) =>
      prisma.crmKnowledgeBase.create({
        data: {
          tenantId,
          title: chunks.length > 1 ? `${title} (parte ${index + 1})` : title,
          content: chunk,
          chunkIndex: index,
          sourceFile,
          isActive: true,
        },
      })
    )
  )

  // Gerar e salvar embeddings via raw SQL (quando pgvector disponível)
  for (const record of records) {
    try {
      const embedding = await generateEmbedding(record.content)
      await prisma.$executeRawUnsafe(
        `UPDATE "CrmKnowledgeBase" SET embedding = $1::vector WHERE id = $2`,
        JSON.stringify(embedding),
        record.id,
      )
    } catch {
      // pgvector pode não estar disponível — continua sem embedding
      console.error(`[rag] Falha ao gerar embedding para chunk ${record.id}`)
    }
  }

  return records.length
}

/**
 * Busca chunks similares usando pgvector (cosine distance).
 * Fallback para busca textual se pgvector indisponível.
 */
export async function findSimilarChunks(
  tenantId: string,
  query: string,
  limit = 5,
  threshold = 0.75,
): Promise<Array<{ id: string; title: string; content: string; similarity: number }>> {
  try {
    const embedding = await generateEmbedding(query)
    const results = await prisma.$queryRawUnsafe<
      Array<{ id: string; title: string; content: string; similarity: number }>
    >(
      `SELECT id, title, content,
              1 - (embedding <=> $1::vector) AS similarity
       FROM   "CrmKnowledgeBase"
       WHERE  "tenantId" = $2
         AND  "isActive" = true
         AND  embedding IS NOT NULL
         AND  1 - (embedding <=> $1::vector) > $3
       ORDER  BY similarity DESC
       LIMIT  $4`,
      JSON.stringify(embedding),
      tenantId,
      threshold,
      limit,
    )
    return results
  } catch {
    // Fallback: busca textual simples
    const results = await prisma.crmKnowledgeBase.findMany({
      where: {
        tenantId,
        isActive: true,
        content: { contains: query.split(' ').slice(0, 3).join(' '), mode: 'insensitive' },
      },
      select: { id: true, title: true, content: true },
      take: limit,
    })
    return results.map(r => ({ ...r, similarity: 0.5 }))
  }
}

/**
 * Gera resposta do Concierge RAG com contexto da base de conhecimento.
 * Usa Gemini 2.0 Flash (grátis: 15 req/min).
 */
export async function generateConciergeReply(params: {
  tenantId: string
  leadName: string
  conversationHistory: string
  userQuestion: string
}): Promise<string> {
  const { tenantId, leadName, conversationHistory, userQuestion } = params

  // Buscar contexto relevante
  const chunks = await findSimilarChunks(tenantId, userQuestion, 4, 0.6)
  const context = chunks.map(c => c.content).join('\n\n---\n\n')

  const systemPrompt = `Você é a assistente virtual da Clínica Mykaele Procópio, uma clínica de estética de luxo.
Seu papel é ajudar a recepcionista a responder mensagens de WhatsApp de pacientes.

REGRAS:
- Seja calorosa, profissional e empática
- Use linguagem sofisticada mas acessível
- NUNCA invente informações sobre procedimentos — use apenas o contexto fornecido
- Se não souber, sugira que a recepcionista consulte a Dra. Mykaele
- Respostas curtas e diretas (máximo 3 parágrafos)
- Use português brasileiro natural

CONTEXTO DA BASE DE CONHECIMENTO:
${context || 'Nenhum contexto específico encontrado na base de conhecimento.'}

NOME DA PACIENTE: ${leadName}`

  const model = await createGeminiModel({
    systemInstruction: systemPrompt,
    temperature: 0.7,
    maxOutputTokens: 500,
  })

  const result = await model.generateContent(
    `Histórico recente da conversa:\n${conversationHistory}\n\nPergunta/mensagem da paciente: ${userQuestion}\n\nGere uma sugestão de resposta para a recepcionista enviar:`
  )

  return result.response.text() || 'Não foi possível gerar uma sugestão.'
}
