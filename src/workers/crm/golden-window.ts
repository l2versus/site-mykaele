// src/workers/crm/golden-window.ts — Análise estatística de conversões similares
import type { Job } from 'bullmq'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})
pool.on('error', (err) => console.error('[worker/golden-window] Pool error:', err.message))
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

interface GoldenWindowPayload {
  type: 'golden-window'
  leadId: string
  tenantId: string
}

/** Nomes dos dias em pt-BR */
const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

/**
 * Calcula o melhor dia e horário para contato baseado em padrão estatístico
 * de leads que converteram (status WON) no mesmo tenant.
 *
 * Analisa em qual dia da semana e faixa horária os leads responderam
 * mais antes de converter.
 */
export async function calculateGoldenWindow(job: Job<GoldenWindowPayload>): Promise<void> {
  const { leadId, tenantId } = job.data

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, tenantId, deletedAt: null },
  })
  if (!lead) return

  // Buscar mensagens de leads que converteram (para análise estatística)
  const wonLeads = await prisma.lead.findMany({
    where: {
      tenantId,
      status: 'WON',
      deletedAt: null,
    },
    select: { id: true },
    take: 100,
  })

  if (wonLeads.length < 3) {
    // Sem dados suficientes — usar padrão genérico para estética
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        bestContactDays: 'Ter,Qua,Qui',
        bestContactHours: '10:00-12:00',
        bestContactBasis: 0,
      },
    })
    return
  }

  const wonLeadIds = wonLeads.map(l => l.id)

  // Buscar mensagens recebidas (não enviadas pela clínica) de leads convertidos
  const messages = await prisma.message.findMany({
    where: {
      conversation: { leadId: { in: wonLeadIds } },
      fromMe: false,
    },
    select: { createdAt: true },
  })

  if (messages.length < 5) {
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        bestContactDays: 'Seg,Ter,Qua',
        bestContactHours: '09:00-11:00',
        bestContactBasis: wonLeads.length,
      },
    })
    return
  }

  // Contar frequência por dia da semana
  const dayCount: Record<number, number> = {}
  // Contar frequência por hora
  const hourCount: Record<number, number> = {}

  for (const msg of messages) {
    const day = msg.createdAt.getDay()
    const hour = msg.createdAt.getHours()
    dayCount[day] = (dayCount[day] ?? 0) + 1
    hourCount[hour] = (hourCount[hour] ?? 0) + 1
  }

  // Top 3 dias
  const topDays = Object.entries(dayCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([d]) => DAY_NAMES[Number(d)])

  // Encontrar faixa horária de pico (janela de 2h)
  let bestHourStart = 9
  let bestHourCount = 0
  for (let h = 7; h <= 20; h++) {
    const windowCount = (hourCount[h] ?? 0) + (hourCount[h + 1] ?? 0)
    if (windowCount > bestHourCount) {
      bestHourCount = windowCount
      bestHourStart = h
    }
  }

  const bestHours = `${String(bestHourStart).padStart(2, '0')}:00-${String(bestHourStart + 2).padStart(2, '0')}:00`

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      bestContactDays: topDays.join(','),
      bestContactHours: bestHours,
      bestContactBasis: wonLeads.length,
    },
  })
}
