// app/api/admin/crm/conversations/summary/route.ts — Resumo automático + análise de sentimento
// Gera resumo da conversa via Gemini e cacheia no campo aiSummary da última mensagem
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createGeminiModel } from '@/lib/gemini'

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const conversationId = req.nextUrl.searchParams.get('conversationId')
    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId obrigatório' }, { status: 400 })
    }

    // Verificar cache: se a última mensagem já tem resumo e nenhuma mensagem nova foi adicionada
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        leadId: true,
        lead: { select: { name: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, aiSummary: true, createdAt: true },
        },
      },
    })

    if (!conversation) {
      return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 })
    }

    const lastMessage = conversation.messages[0]

    // Se a última mensagem já tem resumo cacheado, retornar direto
    if (lastMessage?.aiSummary) {
      try {
        const cached = JSON.parse(lastMessage.aiSummary)
        if (cached.summary && cached.sentiment) {
          return NextResponse.json(cached)
        }
      } catch {
        // aiSummary não é JSON válido, gerar novo
      }
    }

    // Buscar mensagens para análise
    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: 30,
      select: { fromMe: true, content: true, type: true, createdAt: true },
    })

    if (messages.length < 2) {
      return NextResponse.json({
        summary: null,
        reason: 'Poucos mensagens para gerar resumo',
      })
    }

    const leadName = conversation.lead.name
    const history = messages
      .map(m => {
        const sender = m.fromMe ? 'Clínica' : leadName
        const prefix = m.type !== 'TEXT' ? `[${m.type}] ` : ''
        return `${sender}: ${prefix}${m.content}`
      })
      .join('\n')

    const model = await createGeminiModel({
      systemInstruction: `Você é um analista de CRM. Analise a conversa WhatsApp entre uma clínica de estética e um paciente.

Retorne um JSON com EXATAMENTE esta estrutura (sem markdown, sem \`\`\`):
{
  "summary": "Resumo de 1-2 frases da conversa em português",
  "sentiment": "positive" | "negative" | "neutral" | "urgent",
  "sentimentLabel": "Label em pt-BR do sentimento (ex: Positivo, Negativo, Neutro, Urgente)",
  "topics": ["tópico1", "tópico2"],
  "nextAction": "Sugestão de próximo passo em 1 frase",
  "buyingSignal": "hot" | "warm" | "cold" | "none"
}

REGRAS:
- "summary": sintetize o estado atual da conversa, não liste cada mensagem
- "topics": procedimentos mencionados, preocupações, pedidos (max 3)
- "nextAction": ação prática para a recepcionista
- "buyingSignal": quão perto o paciente está de agendar
- "sentiment": baseado no tom geral do paciente (não da clínica)`,
      temperature: 0.3,
      maxOutputTokens: 300,
    })

    const result = await model.generateContent(`Conversa:\n${history}`)
    const text = result.response.text() || ''

    // Parse JSON da resposta
    let parsed: {
      summary: string
      sentiment: string
      sentimentLabel: string
      topics: string[]
      nextAction: string
      buyingSignal: string
    }

    try {
      // Limpar possíveis wrappers de markdown
      const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      parsed = JSON.parse(cleaned)
    } catch {
      // Fallback se Gemini não retornar JSON válido
      parsed = {
        summary: text.slice(0, 200),
        sentiment: 'neutral',
        sentimentLabel: 'Neutro',
        topics: [],
        nextAction: 'Acompanhar conversa',
        buyingSignal: 'none',
      }
    }

    // Cachear no campo aiSummary da última mensagem
    if (lastMessage) {
      await prisma.message.update({
        where: { id: lastMessage.id },
        data: { aiSummary: JSON.stringify(parsed) },
      }).catch(() => { /* non-blocking */ })
    }

    return NextResponse.json(parsed)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[conversation/summary] Error:', msg)
    return NextResponse.json({ error: `Falha no resumo: ${msg}` }, { status: 500 })
  }
}
