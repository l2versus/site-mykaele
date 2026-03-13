// app/api/admin/crm/smart-replies/route.ts — Gera 3 sugestões curtas de resposta via RAG + Gemini
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { findSimilarChunks } from '@/lib/rag'
import { GoogleGenerativeAI } from '@google/generative-ai'

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { conversationId, tenantId } = await req.json()
    if (!conversationId || !tenantId) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY não configurada' }, { status: 500 })
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        lead: { select: { name: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 6,
          select: { fromMe: true, content: true },
        },
      },
    })

    if (!conversation) {
      return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 })
    }

    const reversed = conversation.messages.reverse()
    const history = reversed
      .map(m => `${m.fromMe ? 'Clínica' : conversation.lead.name}: ${m.content}`)
      .join('\n')

    const lastPatientMsg = reversed.filter(m => !m.fromMe).pop()?.content ?? ''

    // Buscar contexto RAG
    let context = ''
    if (lastPatientMsg) {
      const chunks = await findSimilarChunks(tenantId, lastPatientMsg, 3, 0.5)
      context = chunks.map(c => c.content).join('\n---\n')
    }

    const firstName = conversation.lead.name.split(' ')[0] || 'cliente'

    const systemPrompt = `Você é assistente da Clínica Mykaele Procópio (estética de luxo).
Gere EXATAMENTE 3 sugestões CURTAS de resposta para a recepcionista enviar ao paciente.

REGRAS:
- Cada sugestão deve ter NO MÁXIMO 60 caracteres
- Respostas diretas, naturais, como uma recepcionista real falaria
- Use português brasileiro informal-profissional
- NUNCA invente preços ou horários — se não souber, sugira verificar
- Varie o tom: uma mais calorosa, uma mais objetiva, uma mais proativa
- NÃO numere as respostas
- Separe cada sugestão com o caractere |

${context ? `CONTEXTO DA CLÍNICA:\n${context}\n` : ''}
NOME DO PACIENTE: ${firstName}`

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: systemPrompt,
      generationConfig: { temperature: 0.8, maxOutputTokens: 200 },
    })

    const prompt = history
      ? `Histórico:\n${history}\n\nGere 3 sugestões curtas de resposta separadas por |`
      : `Mensagem do paciente: ${lastPatientMsg}\n\nGere 3 sugestões curtas de resposta separadas por |`

    const result = await model.generateContent(prompt)
    const text = result.response.text() || ''

    // Parse: separar por | e limpar
    const suggestions = text
      .split('|')
      .map(s => s.trim().replace(/^\d+[.)]\s*/, '').replace(/^[""]|[""]$/g, ''))
      .filter(s => s.length > 0 && s.length <= 120)
      .slice(0, 3)

    return NextResponse.json({ suggestions })
  } catch (err) {
    console.error('[smart-replies] Error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Falha ao gerar sugestões' }, { status: 500 })
  }
}
