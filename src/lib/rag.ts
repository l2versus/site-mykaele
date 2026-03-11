// src/lib/rag.ts — Pipeline RAG: chunking, embeddings e Concierge IA
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'

let _openai: OpenAI | null = null
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return _openai
}

const CHUNK_SIZE = 1500
const CHUNK_OVERLAP = 200
const EMBEDDING_MODEL = 'text-embedding-3-small'
const CHAT_MODEL = 'gpt-4o-mini'

/**
 * Divide texto em chunks com overlap para preservar contexto.
 * PDFs devem ser pré-processados com pdf-parse antes de chamar esta função.
 */
export function chunkText(text: string, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const chunks: string[] = []
  const cleaned = text.replace(/\n{3,}/g, '\n\n').trim()

  if (cleaned.length <= chunkSize) {
    return [cleaned]
  }

  let start = 0
  while (start < cleaned.length) {
    let end = start + chunkSize

    // Tentar quebrar em parágrafo ou frase
    if (end < cleaned.length) {
      const paragraphBreak = cleaned.lastIndexOf('\n\n', end)
      if (paragraphBreak > start + chunkSize / 2) {
        end = paragraphBreak
      } else {
        const sentenceBreak = cleaned.lastIndexOf('. ', end)
        if (sentenceBreak > start + chunkSize / 2) {
          end = sentenceBreak + 1
        }
      }
    }

    chunks.push(cleaned.slice(start, end).trim())
    start = end - overlap
  }

  return chunks.filter(c => c.length > 50)
}

/**
 * Gera embedding via OpenAI text-embedding-3-small (1536 dim).
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await getOpenAI().embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.slice(0, 8000),
  })
  return response.data[0].embedding
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

  const response = await getOpenAI().chat.completions.create({
    model: CHAT_MODEL,
    temperature: 0.7,
    max_tokens: 500,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Histórico recente da conversa:\n${conversationHistory}\n\nPergunta/mensagem da paciente: ${userQuestion}\n\nGere uma sugestão de resposta para a recepcionista enviar:` },
    ],
  })

  return response.choices[0]?.message?.content ?? 'Não foi possível gerar uma sugestão.'
}
