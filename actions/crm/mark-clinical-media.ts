'use server'

import { z } from 'zod'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog, CRM_ACTIONS } from '@/lib/audit'

const markClinicalMediaSchema = z.object({
  messageId: z.string().min(1),
  isClinical: z.boolean(),
})

interface MarkClinicalMediaResult {
  ok: boolean
  error?: string
}

export async function markClinicalMedia(
  input: z.input<typeof markClinicalMediaSchema>
): Promise<MarkClinicalMediaResult> {
  const parsed = markClinicalMediaSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Dados inválidos' }

  const { messageId, isClinical } = parsed.data

  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return { ok: false, error: 'Não autorizado' }

  const payload = verifyToken(token)
  if (!payload || payload.role !== 'ADMIN') return { ok: false, error: 'Não autorizado' }

  const tenantId = process.env.DEFAULT_TENANT_ID
  if (!tenantId) return { ok: false, error: 'Tenant não configurado' }

  // Verificar que a mensagem pertence ao tenant e é mídia
  const message = await prisma.message.findFirst({
    where: {
      id: messageId,
      tenantId,
      type: { in: ['IMAGE', 'VIDEO', 'DOCUMENT'] },
    },
    select: { id: true, conversationId: true },
  })

  if (!message) return { ok: false, error: 'Mensagem de mídia não encontrada' }

  await prisma.message.update({
    where: { id: messageId },
    data: { isClinicalMedia: isClinical },
  })

  // Log de auditoria — rastreabilidade LGPD para mídias clínicas
  createAuditLog({
    tenantId,
    userId: payload.userId,
    action: CRM_ACTIONS.VIEW_PATIENT_MEDIA,
    entityId: messageId,
    details: {
      action: isClinical ? 'marked_as_clinical' : 'unmarked_as_clinical',
      conversationId: message.conversationId,
    },
  })

  return { ok: true }
}
