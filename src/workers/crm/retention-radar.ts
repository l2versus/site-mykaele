// src/workers/crm/retention-radar.ts — Risco de churn por ciclo biológico do procedimento
import type { Job } from 'bullmq'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import IORedis from 'ioredis'

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})
pool.on('error', (err) => console.error('[worker/retention] Pool error:', err.message))

const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const redis = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    if (times > 10) return null
    return Math.min(times * 500, 15_000)
  },
})
redis.on('error', (err) => console.error('[worker/retention] Redis error:', err.message))

const CRM_CHANNEL = 'crm:events'

/**
 * Ciclos de retorno em dias por procedimento.
 * Quando o paciente ultrapassa o ciclo sem retornar, o risco de churn aumenta.
 */
const PROCEDURE_CYCLES: Record<string, { followUp: number; returnDays: number }> = {
  'botox':                { followUp: 15, returnDays: 120 },
  'preenchimento labial': { followUp: 7,  returnDays: 270 },
  'harmonização facial':  { followUp: 15, returnDays: 180 },
  'bioestimuladores':     { followUp: 30, returnDays: 180 },
  'skinbooster':          { followUp: 7,  returnDays: 90 },
  'peeling químico':      { followUp: 7,  returnDays: 90 },
  'microagulhamento':     { followUp: 30, returnDays: 90 },
}

/** Threshold de risco configurável via env */
const RISK_THRESHOLD = Number(process.env.RETENTION_RISK_THRESHOLD ?? 70)

interface RetentionPayload {
  type: 'retention-radar'
}

/**
 * Job diário: percorre leads WON que têm appointmentId linkado
 * e calcula risco de churn baseado no tempo desde o último procedimento.
 */
export async function runRetentionRadar(job: Job<RetentionPayload>): Promise<void> {
  const tenantId = process.env.DEFAULT_TENANT_ID
  if (!tenantId) {
    console.error('[retention] DEFAULT_TENANT_ID não configurado')
    return
  }

  // Buscar leads ganhos que têm último agendamento linkado
  const leads = await prisma.lead.findMany({
    where: {
      tenantId,
      status: 'WON',
      deletedAt: null,
      linkedAppointmentId: { not: null },
    },
    select: {
      id: true,
      name: true,
      tags: true,
      linkedAppointmentId: true,
      lastInteractionAt: true,
      churnRisk: true,
    },
  })

  let alertCount = 0

  for (const lead of leads) {
    // Buscar procedimento do agendamento linkado
    const appointment = await prisma.appointment.findUnique({
      where: { id: lead.linkedAppointmentId as string },
      select: {
        scheduledAt: true,
        service: { select: { name: true } },
      },
    })

    if (!appointment) continue

    const serviceName = appointment.service.name.toLowerCase()

    // Encontrar ciclo de retorno mais próximo
    let matchedCycle: { followUp: number; returnDays: number } | null = null
    for (const [proc, cycle] of Object.entries(PROCEDURE_CYCLES)) {
      if (serviceName.includes(proc)) {
        matchedCycle = cycle
        break
      }
    }

    if (!matchedCycle) continue

    // Calcular dias desde o procedimento
    const daysSince = Math.floor(
      (Date.now() - appointment.scheduledAt.getTime()) / (24 * 60 * 60 * 1000)
    )

    // Calcular risco baseado na proximidade do ciclo de retorno
    let churnRisk: number

    if (daysSince <= matchedCycle.followUp) {
      // Ainda no período de acompanhamento — risco baixo
      churnRisk = 10
    } else if (daysSince <= matchedCycle.returnDays * 0.7) {
      // Antes do período ideal de retorno — risco moderado crescente
      const progress = (daysSince - matchedCycle.followUp) / (matchedCycle.returnDays * 0.7 - matchedCycle.followUp)
      churnRisk = Math.round(10 + progress * 30) // 10-40
    } else if (daysSince <= matchedCycle.returnDays) {
      // No período ideal de retorno — risco moderado-alto
      const progress = (daysSince - matchedCycle.returnDays * 0.7) / (matchedCycle.returnDays * 0.3)
      churnRisk = Math.round(40 + progress * 30) // 40-70
    } else {
      // Passou do ciclo de retorno — risco alto crescente
      const overdue = daysSince - matchedCycle.returnDays
      churnRisk = Math.min(Math.round(70 + (overdue / matchedCycle.returnDays) * 30), 99)
    }

    // Fator de correção: se houve interação recente, reduzir risco
    if (lead.lastInteractionAt) {
      const daysSinceInteraction = Math.floor(
        (Date.now() - lead.lastInteractionAt.getTime()) / (24 * 60 * 60 * 1000)
      )
      if (daysSinceInteraction < 7) {
        churnRisk = Math.max(churnRisk - 20, 5)
      } else if (daysSinceInteraction < 14) {
        churnRisk = Math.max(churnRisk - 10, 5)
      }
    }

    // Atualizar risco no lead
    await prisma.lead.update({
      where: { id: lead.id },
      data: { churnRisk },
    })

    // Emitir alerta se risco ultrapassou threshold
    if (churnRisk >= RISK_THRESHOLD && (lead.churnRisk ?? 0) < RISK_THRESHOLD) {
      alertCount++
      await redis.publish(CRM_CHANNEL, JSON.stringify({
        type: 'retention-alert',
        tenantId,
        data: {
          leadId: lead.id,
          leadName: lead.name,
          churnRisk,
          procedure: appointment.service.name,
          daysSinceProcedure: daysSince,
        },
      }))
    }
  }

  console.error(`[retention] Processados ${leads.length} leads, ${alertCount} alertas emitidos`)
  void job // usado para referência do BullMQ
}
