// app/api/admin/crm/concierge/route.ts — Gera resposta via Concierge RAG
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateConciergeReply } from '@/lib/rag'
import { createAuditLog, CRM_ACTIONS } from '@/lib/audit'

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

    // Buscar últimas mensagens da conversa
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        lead: { select: { name: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { fromMe: true, content: true, createdAt: true },
        },
      },
    })

    if (!conversation) {
      return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 })
    }

    // Montar histórico
    const history = conversation.messages
      .reverse()
      .map(m => `${m.fromMe ? 'Clínica' : conversation.lead.name}: ${m.content}`)
      .join('\n')

    // Última mensagem do paciente
    const lastPatientMsg = conversation.messages.find(m => !m.fromMe)

    const reply = await generateConciergeReply({
      tenantId,
      leadName: conversation.lead.name,
      conversationHistory: history,
      userQuestion: lastPatientMsg?.content ?? '',
    })

    createAuditLog({
      tenantId,
      userId: payload.userId,
      action: CRM_ACTIONS.CONCIERGE_REPLY,
      entityId: conversationId,
    })

    return NextResponse.json({ reply })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[concierge] POST error:', msg)
    if (err instanceof Error && err.stack) {
      console.error('[concierge] Stack:', err.stack)
    }
    return NextResponse.json({ error: `Falha no Concierge: ${msg}` }, { status: 500 })
  }
}
