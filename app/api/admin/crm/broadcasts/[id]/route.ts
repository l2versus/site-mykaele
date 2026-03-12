// app/api/admin/crm/broadcasts/[id]/route.ts — Detalhes, envio e cancelamento de transmissão
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { evolutionApi } from '@/lib/evolution-api'
import { createAuditLog, CRM_ACTIONS } from '@/lib/audit'

// GET — Detalhes de uma transmissão com recipients
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await params

    const broadcast = await prisma.crmBroadcast.findUnique({
      where: { id },
      include: {
        recipients: {
          orderBy: { leadName: 'asc' },
        },
      },
    })

    if (!broadcast) {
      return NextResponse.json({ error: 'Transmissão não encontrada' }, { status: 404 })
    }

    return NextResponse.json({ broadcast })
  } catch (err) {
    console.error('[broadcasts] GET [id] error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST — Iniciar envio ou cancelar
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const { action } = body // "send" or "cancel"

    const broadcast = await prisma.crmBroadcast.findUnique({
      where: { id },
      include: { recipients: true },
    })

    if (!broadcast) {
      return NextResponse.json({ error: 'Transmissão não encontrada' }, { status: 404 })
    }

    // CANCEL
    if (action === 'cancel') {
      if (broadcast.status !== 'SENDING') {
        return NextResponse.json({ error: 'Só é possível cancelar transmissões em andamento' }, { status: 400 })
      }

      await prisma.crmBroadcast.update({
        where: { id },
        data: { status: 'CANCELLED', completedAt: new Date() },
      })

      createAuditLog({
        tenantId: broadcast.tenantId,
        userId: payload.userId,
        action: CRM_ACTIONS.BROADCAST_CANCELLED,
        entityId: id,
      })

      return NextResponse.json({ success: true, status: 'CANCELLED' })
    }

    // SEND
    if (action !== 'send') {
      return NextResponse.json({ error: 'Ação inválida. Use "send" ou "cancel"' }, { status: 400 })
    }

    if (broadcast.status !== 'DRAFT') {
      return NextResponse.json({ error: 'Só é possível enviar transmissões em rascunho' }, { status: 400 })
    }

    // Find active WhatsApp channel
    const channel = await prisma.crmChannel.findFirst({
      where: { tenantId: broadcast.tenantId, type: 'whatsapp', isActive: true },
    })

    if (!channel?.instanceId) {
      return NextResponse.json({ error: 'Nenhum canal WhatsApp ativo. Conecte na página de Integrações.' }, { status: 400 })
    }

    // Mark as sending
    await prisma.crmBroadcast.update({
      where: { id },
      data: { status: 'SENDING', startedAt: new Date() },
    })

    // Process sending in background (non-blocking response)
    const pendingRecipients = broadcast.recipients.filter(r => r.status === 'PENDING')

    // Start async send process
    void processBroadcastSend(id, broadcast.tenantId, broadcast.message, channel.instanceId, pendingRecipients, payload.userId)

    createAuditLog({
      tenantId: broadcast.tenantId,
      userId: payload.userId,
      action: CRM_ACTIONS.BROADCAST_SENT,
      entityId: id,
      details: { totalRecipients: pendingRecipients.length },
    })

    return NextResponse.json({ success: true, status: 'SENDING', total: pendingRecipients.length })
  } catch (err) {
    console.error('[broadcasts] POST [id] error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// DELETE — Excluir transmissão (apenas DRAFT)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await params

    const broadcast = await prisma.crmBroadcast.findUnique({ where: { id } })
    if (!broadcast) {
      return NextResponse.json({ error: 'Transmissão não encontrada' }, { status: 404 })
    }

    if (broadcast.status === 'SENDING') {
      return NextResponse.json({ error: 'Não é possível excluir uma transmissão em andamento' }, { status: 400 })
    }

    await prisma.crmBroadcast.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[broadcasts] DELETE error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// Background send processor
async function processBroadcastSend(
  broadcastId: string,
  tenantId: string,
  messageTemplate: string,
  instanceId: string,
  recipients: Array<{ id: string; leadId: string; leadName: string; phone: string }>,
  userId: string,
) {
  let sentCount = 0
  let failedCount = 0

  for (const recipient of recipients) {
    // Check if broadcast was cancelled
    const current = await prisma.crmBroadcast.findUnique({
      where: { id: broadcastId },
      select: { status: true },
    })

    if (current?.status === 'CANCELLED') break

    // Replace variables in message
    const firstName = recipient.leadName.split(' ')[0]
    const personalizedMessage = messageTemplate
      .replace(/\{\{nome\}\}/g, recipient.leadName)
      .replace(/\{\{primeiro_nome\}\}/g, firstName)
      .replace(/\{\{telefone\}\}/g, recipient.phone)

    try {
      await evolutionApi.sendText(instanceId, recipient.phone, personalizedMessage)

      await prisma.crmBroadcastRecipient.update({
        where: { id: recipient.id },
        data: { status: 'SENT', sentAt: new Date() },
      })

      sentCount++
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)

      await prisma.crmBroadcastRecipient.update({
        where: { id: recipient.id },
        data: { status: 'FAILED', errorMessage: errorMsg.slice(0, 500) },
      })

      failedCount++
    }

    // Update broadcast counters periodically (every 5 messages)
    if ((sentCount + failedCount) % 5 === 0 || sentCount + failedCount === recipients.length) {
      await prisma.crmBroadcast.update({
        where: { id: broadcastId },
        data: { sent: sentCount, failed: failedCount },
      })
    }

    // Delay between messages (3 seconds) to avoid WhatsApp rate limiting
    if (sentCount + failedCount < recipients.length) {
      await new Promise(resolve => setTimeout(resolve, 3000))
    }
  }

  // Final update
  await prisma.crmBroadcast.update({
    where: { id: broadcastId },
    data: {
      sent: sentCount,
      failed: failedCount,
      status: failedCount === recipients.length ? 'FAILED' : 'COMPLETED',
      completedAt: new Date(),
    },
  })
}
