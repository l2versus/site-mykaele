// src/workers/crm/index.ts — Entry point com todos os workers + graceful shutdown
// Executar: npx tsx src/workers/crm/index.ts
import { Worker } from 'bullmq'
import { redis, bullConnection, inboxQueue, automationQueue, aiQueue, schedulerQueue,
         attachDLQListener } from '../../lib/queues'
import { registerScheduledJobs } from '../../lib/queues/scheduler'
import { processWebhook, type WebhookResult } from './process-webhook'
import { calculateAiScore } from './calculate-ai-score'
import { calculateGoldenWindow } from './golden-window'
import { runRetentionRadar } from './retention-radar'
import { executeAutomation } from './execute-automation'
import { reconcileMessages } from './reconcile-messages'
import { runAutomationScheduler } from './automation-scheduler'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})
pool.on('error', (err) => console.error('[worker/index] Pool error:', err.message))
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const workers: Worker[] = []

// === WORKER: INBOX ===
const inboxWorker = new Worker(
  'crm-inbox',
  async (job) => {
    const result: WebhookResult | null = await processWebhook(job)

    // Após processar mensagem, enfileirar cálculo de AI score
    if (result) {
      await aiQueue.add('calculate-score', {
        type: 'calculate-ai-score',
        leadId: result.leadId,
        tenantId: result.tenantId,
      })
      await aiQueue.add('golden-window', {
        type: 'golden-window',
        leadId: result.leadId,
        tenantId: result.tenantId,
      })
    }
  },
  { connection: bullConnection, concurrency: 5 },
)
workers.push(inboxWorker)

// === WORKER: AUTOMATION ===
const automationWorker = new Worker(
  'crm-automation',
  async (job) => {
    if (job.data.type === 'execute-automation') {
      await executeAutomation(job)
    }
  },
  { connection: bullConnection, concurrency: 3 },
)
workers.push(automationWorker)

// === WORKER: AI ===
const aiWorker = new Worker(
  'crm-ai',
  async (job) => {
    switch (job.data.type) {
      case 'calculate-ai-score':
        await calculateAiScore(job)
        break
      case 'golden-window':
        await calculateGoldenWindow(job)
        break
      case 'retention-radar':
        await runRetentionRadar(job)
        break
    }
  },
  { connection: bullConnection, concurrency: 2 },
)
workers.push(aiWorker)

// === WORKER: SCHEDULER ===
const schedulerWorker = new Worker(
  'crm-scheduler',
  async (job) => {
    switch (job.data.type) {
      case 'reconcile-messages':
        await reconcileMessages(job)
        break
      case 'refresh-stage-cache':
        await refreshStageCache()
        break
      case 'automation-scheduler':
        await runAutomationScheduler()
        break
    }
  },
  { connection: bullConnection, concurrency: 1 },
)
workers.push(schedulerWorker)

/**
 * Recalcula cache de contagem e valor total em cada estágio.
 * Roda a cada 15 minutos para manter consistência.
 */
async function refreshStageCache(): Promise<void> {
  const tenantId = process.env.DEFAULT_TENANT_ID
  if (!tenantId) return

  const stages = await prisma.stage.findMany({
    where: { tenantId },
    select: { id: true },
  })

  for (const stage of stages) {
    const agg = await prisma.lead.aggregate({
      where: { stageId: stage.id, deletedAt: null },
      _count: true,
      _sum: { expectedValue: true },
    })

    await prisma.stage.update({
      where: { id: stage.id },
      data: {
        cachedLeadCount: agg._count,
        cachedTotalValue: agg._sum.expectedValue ?? 0,
        cacheUpdatedAt: new Date(),
      },
    })
  }
}

// === DLQ LISTENERS ===
attachDLQListener(inboxQueue)
attachDLQListener(automationQueue)
attachDLQListener(aiQueue)

// === GRACEFUL SHUTDOWN ===
async function shutdown(signal: string): Promise<void> {
  console.error(`[workers] Recebido ${signal}, encerrando...`)

  await Promise.all(workers.map(w => w.close()))
  await redis.quit()
  await pool.end()

  console.error('[workers] Encerrado com sucesso')
  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

// === STARTUP ===
async function start(): Promise<void> {
  console.error('[workers] Iniciando workers CRM...')

  await registerScheduledJobs()

  console.error('[workers] Jobs agendados registrados')
  console.error('[workers] Workers ativos:')
  console.error('  - crm-inbox (concurrency: 5)')
  console.error('  - crm-automation (concurrency: 3)')
  console.error('  - crm-ai (concurrency: 2)')
  console.error('  - crm-scheduler (concurrency: 1)')
  console.error('[workers] Aguardando jobs...')
}

start().catch((err) => {
  console.error('[workers] Falha na inicialização:', err)
  process.exit(1)
})
