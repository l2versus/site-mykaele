// src/lib/lgpd.ts — Anonimização de leads (Artigo 18 LGPD — Direito ao Esquecimento)
import { prisma } from '@/lib/prisma'
import { createAuditLog, CRM_ACTIONS } from '@/lib/audit'

/**
 * Anonimiza um lead preservando integridade histórica de relatórios.
 * NÃO deleta registros — substitui dados pessoais por valores anônimos.
 *
 * Dados anonimizados: nome, telefone, email, tags, source
 * Dados preservados: IDs, valores financeiros, timestamps, aiScore
 */
export async function anonymizeLead(params: {
  leadId: string
  tenantId: string
  userId: string
  reason: string
}): Promise<void> {
  const { leadId, tenantId, userId, reason } = params

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, tenantId, deletedAt: null },
  })

  if (!lead) {
    throw new Error('Lead não encontrado ou já anonimizado')
  }

  const anonymousId = `ANON-${leadId.slice(-8).toUpperCase()}`

  await prisma.$transaction([
    // Anonimizar dados pessoais do lead
    prisma.lead.update({
      where: { id: leadId },
      data: {
        name: anonymousId,
        phone: `0000000${leadId.slice(-4)}`,
        email: null,
        tags: [],
        source: null,
        deletedAt: new Date(),
      },
    }),

    // Anonimizar conteúdo das mensagens
    prisma.message.updateMany({
      where: {
        conversation: { leadId },
        tenantId,
      },
      data: {
        content: '[CONTEÚDO ANONIMIZADO POR LGPD]',
        mediaUrl: null,
        sentiment: null,
        aiSummary: null,
      },
    }),

    // Anonimizar atividades
    prisma.leadActivity.updateMany({
      where: { leadId },
      data: {
        payload: { anonymized: true, reason },
      },
    }),
  ])

  // Log de auditoria (fire-and-forget)
  createAuditLog({
    tenantId,
    userId,
    action: CRM_ACTIONS.LEAD_ANONYMIZED,
    entityId: leadId,
    details: {
      reason,
      originalName: lead.name,
      anonymizedTo: anonymousId,
    },
  })
}
