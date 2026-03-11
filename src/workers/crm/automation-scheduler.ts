// src/workers/crm/automation-scheduler.ts — Agendador de automações baseadas em tempo
// Roda a cada minuto via BullMQ repeat pattern.
// Verifica triggers temporais (CONTACT_IDLE, APPOINTMENT_BOOKED, APPOINTMENT_COMPLETED)
// e enfileira execuções na fila de automação com jobId determinístico (evita duplicatas).

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { automationQueue } from '../../lib/queues'

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})
pool.on('error', (err) => console.error('[automation-scheduler] Pool error:', err.message))
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// ━━━ Types ━━━

interface AutomationWithFlow {
  id: string
  tenantId: string
  trigger: string
  flowJson: unknown
}

interface FlowConfig {
  idleMinutes?: number      // CONTACT_IDLE: minutos sem interação
  offsetMinutes?: number    // APPOINTMENT_*: minutos antes/depois do agendamento
  action?: string
  message?: string
  conditions?: Array<{ field: string; op: string; value: string }>
  stageId?: string
  tag?: string
  nodes?: unknown[]
}

// ━━━ Main Entry Point ━━━

export async function runAutomationScheduler(): Promise<void> {
  const tenantId = process.env.DEFAULT_TENANT_ID
  if (!tenantId) return

  // Busca todas as automações ativas com triggers temporais
  const automations = await prisma.crmAutomation.findMany({
    where: {
      tenantId,
      isActive: true,
      trigger: { in: ['CONTACT_IDLE', 'APPOINTMENT_BOOKED', 'APPOINTMENT_COMPLETED'] },
    },
  }) as AutomationWithFlow[]

  if (automations.length === 0) return

  for (const automation of automations) {
    try {
      switch (automation.trigger) {
        case 'CONTACT_IDLE':
          await processContactIdle(automation)
          break
        case 'APPOINTMENT_BOOKED':
          await processAppointmentBooked(automation)
          break
        case 'APPOINTMENT_COMPLETED':
          await processAppointmentCompleted(automation)
          break
      }
    } catch (err) {
      console.error(
        `[automation-scheduler] Erro ao processar automação ${automation.id}:`,
        (err as Error).message,
      )
    }
  }
}

// ━━━ CONTACT_IDLE ━━━
// Verifica leads que não tiveram interação por X minutos.
// flowJson.idleMinutes define o limiar (padrão: 2880 = 48h).

async function processContactIdle(automation: AutomationWithFlow): Promise<void> {
  const flow = automation.flowJson as FlowConfig
  const idleMinutes = flow.idleMinutes ?? 2880 // 48h padrão
  const cutoff = new Date(Date.now() - idleMinutes * 60_000)

  // Leads com última interação antes do cutoff, que não estão fechados
  const leads = await prisma.lead.findMany({
    where: {
      tenantId: automation.tenantId,
      deletedAt: null,
      status: { notIn: ['WON', 'LOST'] },
      lastInteractionAt: { lt: cutoff, not: null },
    },
    select: { id: true },
    take: 100, // Batch de segurança para não sobrecarregar
  })

  for (const lead of leads) {
    // jobId determinístico: mesmo lead + mesma automação + mesmo dia = não duplica
    const dateKey = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
    const jobId = `sched:idle:${automation.id}:${lead.id}:${dateKey}`

    await automationQueue.add('execute-automation-scheduled', {
      type: 'execute-automation' as const,
      automationId: automation.id,
      tenantId: automation.tenantId,
      leadId: lead.id,
      context: { scheduledBy: 'automation-scheduler', trigger: 'CONTACT_IDLE' },
    }, { jobId })
  }
}

// ━━━ APPOINTMENT_BOOKED ━━━
// Envia lembrete/ação X minutos ANTES de consultas agendadas.
// flowJson.offsetMinutes define antecedência (padrão: 1440 = 24h antes).
// Usa linkedAppointmentId no Lead para cruzar com Appointment.

async function processAppointmentBooked(automation: AutomationWithFlow): Promise<void> {
  const flow = automation.flowJson as FlowConfig
  const offsetMinutes = flow.offsetMinutes ?? 1440 // 24h antes, padrão

  // Janela: agendamentos entre agora+offset e agora+offset+1min
  // Garante que cada consulta seja capturada exatamente uma vez (scheduler roda a cada 1min)
  const windowStart = new Date(Date.now() + offsetMinutes * 60_000)
  const windowEnd = new Date(windowStart.getTime() + 60_000)

  // Busca consultas na janela que estão confirmadas/pendentes
  const appointments = await prisma.appointment.findMany({
    where: {
      scheduledAt: { gte: windowStart, lt: windowEnd },
      status: { in: ['PENDING', 'CONFIRMED'] },
    },
    select: { id: true, userId: true },
  })

  if (appointments.length === 0) return

  const appointmentIds = appointments.map(a => a.id)

  // Busca leads linkados a essas consultas
  const leads = await prisma.lead.findMany({
    where: {
      tenantId: automation.tenantId,
      deletedAt: null,
      linkedAppointmentId: { in: appointmentIds },
    },
    select: { id: true, linkedAppointmentId: true },
  })

  for (const lead of leads) {
    const jobId = `sched:appt-booked:${automation.id}:${lead.id}:${lead.linkedAppointmentId}`

    await automationQueue.add('execute-automation-scheduled', {
      type: 'execute-automation' as const,
      automationId: automation.id,
      tenantId: automation.tenantId,
      leadId: lead.id,
      context: {
        scheduledBy: 'automation-scheduler',
        trigger: 'APPOINTMENT_BOOKED',
        appointmentId: lead.linkedAppointmentId,
      },
    }, { jobId })
  }
}

// ━━━ APPOINTMENT_COMPLETED ━━━
// Ação pós-consulta: dispara X minutos DEPOIS da conclusão.
// flowJson.offsetMinutes define atraso (padrão: 60 = 1h depois).
// Usa status 'COMPLETED' no Appointment.

async function processAppointmentCompleted(automation: AutomationWithFlow): Promise<void> {
  const flow = automation.flowJson as FlowConfig
  const offsetMinutes = flow.offsetMinutes ?? 60 // 1h depois, padrão

  // Janela: consultas completadas entre agora-offset-1min e agora-offset
  const windowEnd = new Date(Date.now() - offsetMinutes * 60_000)
  const windowStart = new Date(windowEnd.getTime() - 60_000)

  const appointments = await prisma.appointment.findMany({
    where: {
      endAt: { gte: windowStart, lt: windowEnd },
      status: 'COMPLETED',
    },
    select: { id: true },
  })

  if (appointments.length === 0) return

  const appointmentIds = appointments.map(a => a.id)

  const leads = await prisma.lead.findMany({
    where: {
      tenantId: automation.tenantId,
      deletedAt: null,
      linkedAppointmentId: { in: appointmentIds },
    },
    select: { id: true, linkedAppointmentId: true },
  })

  for (const lead of leads) {
    const jobId = `sched:appt-done:${automation.id}:${lead.id}:${lead.linkedAppointmentId}`

    await automationQueue.add('execute-automation-scheduled', {
      type: 'execute-automation' as const,
      automationId: automation.id,
      tenantId: automation.tenantId,
      leadId: lead.id,
      context: {
        scheduledBy: 'automation-scheduler',
        trigger: 'APPOINTMENT_COMPLETED',
        appointmentId: lead.linkedAppointmentId,
      },
    }, { jobId })
  }
}
