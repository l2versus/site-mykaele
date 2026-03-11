// src/workers/crm/calculate-ai-score.ts — Score ponderado em 5 fatores sem chamar LLM
import type { Job } from 'bullmq'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

interface ScorePayload {
  type: 'calculate-ai-score'
  leadId: string
  tenantId: string
}

/**
 * Score de 0 a 100 baseado em 5 fatores ponderados:
 * 1. Frequência de interação (25%)
 * 2. Recência da última mensagem (25%)
 * 3. Volume de mensagens (20%)
 * 4. Engajamento (responde rápido?) (15%)
 * 5. Valor esperado (15%)
 */
export async function calculateAiScore(job: Job<ScorePayload>): Promise<void> {
  const { leadId, tenantId } = job.data

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, tenantId, deletedAt: null },
  })
  if (!lead) return

  // Buscar mensagens dos últimos 30 dias
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const messages = await prisma.message.findMany({
    where: {
      conversation: { leadId },
      tenantId,
      createdAt: { gte: thirtyDaysAgo },
    },
    select: { fromMe: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })

  const totalMessages = messages.length
  const incomingMessages = messages.filter(m => !m.fromMe)
  const outgoingMessages = messages.filter(m => m.fromMe)

  // Fator 1: Frequência de interação (quantos dias distintos houve contato)
  const distinctDays = new Set(
    messages.map(m => m.createdAt.toISOString().slice(0, 10))
  ).size
  const frequencyScore = Math.min(distinctDays / 10, 1) * 100

  // Fator 2: Recência (quão recente foi a última mensagem)
  const lastMessage = messages[messages.length - 1]
  let recencyScore = 0
  if (lastMessage) {
    const daysSince = (Date.now() - lastMessage.createdAt.getTime()) / (24 * 60 * 60 * 1000)
    if (daysSince < 1) recencyScore = 100
    else if (daysSince < 3) recencyScore = 80
    else if (daysSince < 7) recencyScore = 60
    else if (daysSince < 14) recencyScore = 30
    else recencyScore = 10
  }

  // Fator 3: Volume de mensagens do contato
  const volumeScore = Math.min(incomingMessages.length / 20, 1) * 100

  // Fator 4: Engajamento (razão mensagens recebidas vs enviadas)
  let engagementScore = 50
  if (outgoingMessages.length > 0 && incomingMessages.length > 0) {
    const ratio = incomingMessages.length / outgoingMessages.length
    if (ratio >= 1.5) engagementScore = 100
    else if (ratio >= 1) engagementScore = 80
    else if (ratio >= 0.5) engagementScore = 60
    else engagementScore = 30
  } else if (totalMessages === 0) {
    engagementScore = 0
  }

  // Fator 5: Valor esperado
  let valueScore = 0
  if (lead.expectedValue) {
    if (lead.expectedValue >= 5000) valueScore = 100
    else if (lead.expectedValue >= 2000) valueScore = 80
    else if (lead.expectedValue >= 500) valueScore = 50
    else valueScore = 20
  }

  // Score final ponderado
  const score = Math.round(
    frequencyScore * 0.25 +
    recencyScore * 0.25 +
    volumeScore * 0.20 +
    engagementScore * 0.15 +
    valueScore * 0.15
  )

  // Label baseado no score
  let label: string
  if (score >= 80) label = 'Muito Quente'
  else if (score >= 60) label = 'Quente'
  else if (score >= 40) label = 'Morno'
  else if (score >= 20) label = 'Frio'
  else label = 'Gelado'

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      aiScore: score,
      aiScoreLabel: label,
    },
  })
}
