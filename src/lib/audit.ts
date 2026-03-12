// src/lib/audit.ts — Log de auditoria LGPD (fire-and-forget)
import { prisma } from '@/lib/prisma'

interface AuditParams {
  tenantId: string
  userId: string
  action: string
  entityId?: string
  details?: Record<string, unknown>
  ipAddress?: string
}

/**
 * Cria log de auditoria de forma assíncrona (fire-and-forget).
 * Nunca bloqueia a operação principal.
 * Falhas são logadas em stderr, nunca propagadas.
 */
export function createAuditLog(params: AuditParams): void {
  void prisma.crmAuditLog.create({
    data: {
      tenantId: params.tenantId,
      userId: params.userId,
      action: params.action,
      entityId: params.entityId,
      details: params.details ? (params.details as Parameters<typeof prisma.crmAuditLog.create>[0]['data']['details']) : undefined,
      ipAddress: params.ipAddress,
    },
  }).catch((err: unknown) => {
    console.error('[audit] Falha ao gravar log:', err instanceof Error ? err.message : err)
  })
}

/** Ações padronizadas do CRM */
export const CRM_ACTIONS = {
  LEAD_CREATED: 'LEAD_CREATED',
  LEAD_MOVED: 'LEAD_MOVED',
  LEAD_WON: 'LEAD_WON',
  LEAD_LOST: 'LEAD_LOST',
  LEAD_DELETED: 'LEAD_DELETED',
  LEAD_ANONYMIZED: 'LEAD_ANONYMIZED',
  MESSAGE_SENT: 'MESSAGE_SENT',
  MESSAGE_RECEIVED: 'MESSAGE_RECEIVED',
  AUTOMATION_TRIGGERED: 'AUTOMATION_TRIGGERED',
  AUTOMATION_CREATED: 'AUTOMATION_CREATED',
  AUTOMATION_UPDATED: 'AUTOMATION_UPDATED',
  AUTOMATION_DELETED: 'AUTOMATION_DELETED',
  INTEGRATION_CONNECTED: 'INTEGRATION_CONNECTED',
  INTEGRATION_DISCONNECTED: 'INTEGRATION_DISCONNECTED',
  KNOWLEDGE_UPLOADED: 'KNOWLEDGE_UPLOADED',
  VIEW_PATIENT_MEDIA: 'VIEW_PATIENT_MEDIA',
  CONCIERGE_REPLY: 'CONCIERGE_REPLY',
  LEAD_CONVERTED: 'LEAD_CONVERTED',
  STAGE_CREATED: 'STAGE_CREATED',
  STAGE_UPDATED: 'STAGE_UPDATED',
  STAGE_DELETED: 'STAGE_DELETED',
  STAGE_REORDERED: 'STAGE_REORDERED',
  BROADCAST_CREATED: 'BROADCAST_CREATED',
  BROADCAST_SENT: 'BROADCAST_SENT',
  BROADCAST_CANCELLED: 'BROADCAST_CANCELLED',
  TEAM_MEMBER_ADDED: 'TEAM_MEMBER_ADDED',
  TEAM_MEMBER_UPDATED: 'TEAM_MEMBER_UPDATED',
  TEAM_MEMBER_REMOVED: 'TEAM_MEMBER_REMOVED',
} as const
