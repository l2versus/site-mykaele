// src/lib/queues/scheduler.ts — Jobs periódicos usando repeat.pattern (NUNCA upsertJobScheduler)
import { schedulerQueue, aiQueue } from './index'

/**
 * Registra todos os jobs periódicos do CRM.
 * Chamado UMA VEZ na inicialização do worker.
 * Usa repeat.pattern (cron) — compatível com BullMQ gratuito.
 */
export async function registerScheduledJobs(): Promise<void> {
  // Limpa repeatable jobs antigos para evitar duplicatas
  const existing = await schedulerQueue.getRepeatableJobs()
  for (const job of existing) {
    await schedulerQueue.removeRepeatableByKey(job.key)
  }

  // Radar de Retenção — roda diariamente às 8h (configurável via env)
  const retentionCron = process.env.RETENTION_RADAR_CRON ?? '0 8 * * *'
  await aiQueue.add(
    'retention-radar',
    { type: 'retention-radar' },
    {
      repeat: { pattern: retentionCron },
      jobId: 'retention-radar-daily',
    },
  )

  // Reconciliação de mensagens — a cada hora
  await schedulerQueue.add(
    'reconcile-messages',
    { type: 'reconcile-messages' },
    {
      repeat: { pattern: '0 * * * *' },
      jobId: 'reconcile-hourly',
    },
  )

  // Rebalanceamento de cache de estágios — a cada 15 min
  await schedulerQueue.add(
    'refresh-stage-cache',
    { type: 'refresh-stage-cache' },
    {
      repeat: { pattern: '*/15 * * * *' },
      jobId: 'stage-cache-refresh',
    },
  )
}
