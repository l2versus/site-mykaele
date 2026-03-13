// src/lib/activity-log.ts — Helper para registrar atividades no CRM
import { prisma } from '@/lib/prisma'

export type ActivityType =
  | 'LEAD_CREATED' | 'LEAD_STAGE_CHANGED' | 'LEAD_WON' | 'LEAD_LOST'
  | 'MESSAGE_SENT' | 'MESSAGE_RECEIVED'
  | 'EMAIL_SENT'
  | 'TASK_CREATED' | 'TASK_COMPLETED'
  | 'PROPOSAL_SENT' | 'PROPOSAL_ACCEPTED' | 'PROPOSAL_REJECTED'
  | 'NPS_SENT' | 'NPS_RESPONDED'
  | 'NOTE_ADDED'
  | 'BROADCAST_SENT'

interface LogActivityParams {
  tenantId: string
  type: ActivityType
  description: string
  leadId?: string
  userId?: string
  metadata?: Record<string, unknown>
}

/** Registra atividade de forma fire-and-forget (não bloqueia a request) */
export function logActivity(params: LogActivityParams) {
  void prisma.crmActivityLog.create({
    data: {
      tenantId: params.tenantId,
      type: params.type,
      description: params.description,
      leadId: params.leadId ?? null,
      userId: params.userId ?? null,
      metadata: params.metadata ?? null,
    },
  }).catch(console.error)
}
