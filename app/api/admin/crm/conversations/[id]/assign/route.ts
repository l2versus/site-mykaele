import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

function getAdmin(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const u = verifyToken(auth.substring(7))
  return u?.role === 'ADMIN' ? u : null
}

// POST — atendente ASSUME (pausa o bot) ou LIBERA (volta o bot) a conversa.
// body: { assume: boolean } — assume=true atribui ao atendente logado; assume=false libera (volta o bot).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = getAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  try {
    const body = await req.json().catch(() => ({ assume: true }))
    const assume = body?.assume !== false // default: assumir

    const conversation = await prisma.conversation.findUnique({
      where: { id },
      select: { id: true, leadId: true },
    })
    if (!conversation) return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 })

    const assignedToUserId = assume ? admin.userId : null
    await prisma.conversation.update({ where: { id }, data: { assignedToUserId } })

    // Histórico no lead (não bloqueia a resposta se falhar)
    await prisma.leadActivity.create({
      data: {
        leadId: conversation.leadId,
        type: assignedToUserId ? 'CONVERSATION_ASSUMED' : 'CONVERSATION_RELEASED',
        payload: { byUserId: admin.userId, at: new Date().toISOString() },
      },
    }).catch(() => {})

    // assignedToUserId != null => IA, auto-reply e bot pulam esta conversa
    return NextResponse.json({ success: true, assignedToUserId, botPaused: !!assignedToUserId })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao assumir conversa' },
      { status: 500 },
    )
  }
}
