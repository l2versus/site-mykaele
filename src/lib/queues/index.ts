// src/lib/queues/index.ts — BullMQ (versão gratuita) com DLQ integrada
import { Queue, QueueEvents } from 'bullmq'
import IORedis from 'ioredis'

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379'

// Conexão compartilhada para publicar/subscribar SSE (fora do BullMQ)
export const redis = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
})

// Parse Redis URL para connection options
function parseBullConnection() {
  const parsed = new URL(redisUrl)
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 6379,
    password: parsed.password || undefined,
    db: parsed.pathname ? Number(parsed.pathname.slice(1)) || 0 : 0,
    maxRetriesPerRequest: null as null,
  }
}

export const bullConnection = parseBullConnection()

const defaultOpts = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 1_000 },
  removeOnComplete: { count: 200 },
  removeOnFail: false,
}

// Lazy queue creation — evita instanciar durante build do Next.js
let _inboxQueue: Queue | null = null
let _automationQueue: Queue | null = null
let _aiQueue: Queue | null = null
let _schedulerQueue: Queue | null = null
let _dlqQueue: Queue | null = null

/** Fila de entrada — webhooks e mensagens recebidas */
export function getInboxQueue(): Queue {
  if (!_inboxQueue) _inboxQueue = new Queue('crm-inbox', { connection: bullConnection, defaultJobOptions: defaultOpts })
  return _inboxQueue
}

/** Fila de automação — execução de fluxos */
export function getAutomationQueue(): Queue {
  if (!_automationQueue) _automationQueue = new Queue('crm-automation', { connection: bullConnection, defaultJobOptions: defaultOpts })
  return _automationQueue
}

/** Fila de IA — scoring, janela de ouro, radar de retenção */
export function getAiQueue(): Queue {
  if (!_aiQueue) _aiQueue = new Queue('crm-ai', { connection: bullConnection, defaultJobOptions: { ...defaultOpts, attempts: 2 } })
  return _aiQueue
}

/** Fila de tarefas agendadas */
export function getSchedulerQueue(): Queue {
  if (!_schedulerQueue) _schedulerQueue = new Queue('crm-scheduler', { connection: bullConnection })
  return _schedulerQueue
}

/** Dead Letter Queue — jobs que falharam após todas as tentativas */
export function getDlqQueue(): Queue {
  if (!_dlqQueue) _dlqQueue = new Queue('crm-dlq', { connection: bullConnection, defaultJobOptions: { attempts: 1 } })
  return _dlqQueue
}

// Aliases para compatibilidade
export const inboxQueue = { add: (...args: Parameters<Queue['add']>) => getInboxQueue().add(...args), getJob: (...args: Parameters<Queue['getJob']>) => getInboxQueue().getJob(...args), get name() { return getInboxQueue().name } }
export const automationQueue = { add: (...args: Parameters<Queue['add']>) => getAutomationQueue().add(...args), getJob: (...args: Parameters<Queue['getJob']>) => getAutomationQueue().getJob(...args), get name() { return getAutomationQueue().name } }
export const aiQueue = { add: (...args: Parameters<Queue['add']>) => getAiQueue().add(...args), getJob: (...args: Parameters<Queue['getJob']>) => getAiQueue().getJob(...args), get name() { return getAiQueue().name } }
export const schedulerQueue = {
  add: (...args: Parameters<Queue['add']>) => getSchedulerQueue().add(...args),
  getRepeatableJobs: () => getSchedulerQueue().getRepeatableJobs(),
  removeRepeatableByKey: (key: string) => getSchedulerQueue().removeRepeatableByKey(key),
  get name() { return getSchedulerQueue().name },
}
export const dlqQueue = {
  add: (...args: Parameters<Queue['add']>) => getDlqQueue().add(...args),
  getJob: (...args: Parameters<Queue['getJob']>) => getDlqQueue().getJob(...args),
  getWaiting: (...args: Parameters<Queue['getWaiting']>) => getDlqQueue().getWaiting(...args),
  getCompleted: (...args: Parameters<Queue['getCompleted']>) => getDlqQueue().getCompleted(...args),
  get name() { return getDlqQueue().name },
}

/** Move job falho para DLQ com contexto completo */
export async function moveToDLQ(params: {
  originalQueue: string
  jobId: string
  reason: string
  payload: unknown
}): Promise<void> {
  await getDlqQueue().add('dead-job', {
    ...params,
    failedAt: new Date().toISOString(),
  })
}

/** Anexa listener de falha que move para DLQ automaticamente */
export function attachDLQListener(queue: { name: string }): void {
  const events = new QueueEvents(queue.name, { connection: bullConnection })
  events.on('failed', async ({ jobId, failedReason }) => {
    const realQueue = new Queue(queue.name, { connection: bullConnection })
    const job = await realQueue.getJob(jobId)
    if (!job) return
    const maxAttempts = job.opts?.attempts ?? 3
    if (job.attemptsMade >= maxAttempts) {
      await moveToDLQ({
        originalQueue: queue.name,
        jobId,
        reason: failedReason,
        payload: job.data,
      })
    }
  })
}
