'use server'

import { z } from 'zod'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { evolutionApi } from '@/lib/evolution-api'
import { createAuditLog, CRM_ACTIONS } from '@/lib/audit'
import { redis, isRedisReady } from '@/lib/redis'

const sendMessageSchema = z.object({
  conversationId: z.string().min(1),
  text: z.string().min(1).max(4096),
})

interface SendMessageResult {
  ok: boolean
  messageId?: string
  error?: string
}

export async function sendMessage(input: z.input<typeof sendMessageSchema>): Promise<SendMessageResult> {
  const parsed = sendMessageSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Dados inválidos' }

  const { conversationId, text } = parsed.data

  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return { ok: false, error: 'Não autorizado' }

  const payload = verifyToken(token)
  if (!payload || payload.role !== 'ADMIN') return { ok: false, error: 'Não autorizado' }

  const tenantId = process.env.DEFAULT_TENANT_ID
  if (!tenantId) return { ok: false, error: 'Tenant não configurado' }

  // Buscar conversa com canal
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, tenantId },
    include: {
      channel: { select: { instanceId: true } },
    },
  })

  if (!conversation) return { ok: false, error: 'Conversa não encontrada' }
  if (!conversation.channel.instanceId) return { ok: false, error: 'Canal sem instância configurada' }

  // Enviar via Evolution API
  const result = await evolutionApi.sendText(
    conversation.channel.instanceId,
    conversation.remoteJid,
    text,
  )

  // Salvar mensagem no banco
  const message = await prisma.message.create({
    data: {
      conversationId,
      tenantId,
      waMessageId: result.key.id,
      fromMe: true,
      type: 'TEXT',
      content: text,
      status: 'SENT',
      sentByUserId: payload.userId,
    },
  })

  // Atualizar timestamp da conversa e do lead
  await prisma.$transaction([
    prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    }),
    prisma.lead.update({
      where: { id: conversation.leadId },
      data: { lastInteractionAt: new Date() },
    }),
  ])

  // Log de auditoria
  createAuditLog({
    tenantId,
    userId: payload.userId,
    action: CRM_ACTIONS.MESSAGE_SENT,
    entityId: message.id,
    details: { conversationId, leadId: conversation.leadId },
  })

  // Notificar front-end via SSE (fire-and-forget)
  if (isRedisReady()) {
    redis.publish('crm:events', JSON.stringify({
      type: 'new-message',
      tenantId,
      data: {
        conversationId,
        leadId: conversation.leadId,
        messageId: message.id,
        fromMe: true,
        content: text.slice(0, 100),
        messageType: 'TEXT',
      },
    })).catch(() => {})
  }

  return { ok: true, messageId: message.id }
}
