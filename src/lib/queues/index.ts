// src/lib/queues/index.ts — BullMQ (versão gratuita) com DLQ integrada
// Importa Redis centralizado de src/lib/redis.ts
import { Queue, QueueEvents } from 'bullmq'
import { redis, parseBullConnection, isRedisReady } from '../redis'

// Re-exporta para código que já importa daqui
export { redis }

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

// Aliases com proxy seguro — se Redis offline, loga e não crasheia
function safeQueueProxy(getQueue: () => Queue, queueName: string) {
  return {
    add: async (...args: Parameters<Queue['add']>) => {
      if (!isRedisReady()) {
        console.error(`[queues] Redis offline — job descartado na fila "${queueName}":`, args[0])
        return null
      }
      return getQueue().add(...args)
    },
    getJob: async (...args: Parameters<Queue['getJob']>) => {
      if (!isRedisReady()) return null
      return getQueue().getJob(...args)
    },
    get name() { return queueName },
  }
}

export const inboxQueue = safeQueueProxy(getInboxQueue, 'crm-inbox')
export const automationQueue = safeQueueProxy(getAutomationQueue, 'crm-automation')
export const aiQueue = safeQueueProxy(getAiQueue, 'crm-ai')

export const schedulerQueue = {
  ...safeQueueProxy(getSchedulerQueue, 'crm-scheduler'),
  getRepeatableJobs: async () => {
    if (!isRedisReady()) return []
    return getSchedulerQueue().getRepeatableJobs()
  },
  removeRepeatableByKey: async (key: string) => {
    if (!isRedisReady()) return
    return getSchedulerQueue().removeRepeatableByKey(key)
  },
}

export const dlqQueue = {
  ...safeQueueProxy(getDlqQueue, 'crm-dlq'),
  getWaiting: async (...args: Parameters<Queue['getWaiting']>) => {
    if (!isRedisReady()) return []
    return getDlqQueue().getWaiting(...args)
  },
  getCompleted: async (...args: Parameters<Queue['getCompleted']>) => {
    if (!isRedisReady()) return []
    return getDlqQueue().getCompleted(...args)
  },
}

/** Move job falho para DLQ com contexto completo */
export async function moveToDLQ(params: {
  originalQueue: string
  jobId: string
  reason: string
  payload: unknown
}): Promise<void> {
  if (!isRedisReady()) {
    console.error('[queues] Redis offline — não foi possível mover job para DLQ:', params.jobId)
    return
  }
  await getDlqQueue().add('dead-job', {
    ...params,
    failedAt: new Date().toISOString(),
  })
}

/** Anexa listener de falha que move para DLQ automaticamente */
export function attachDLQListener(queue: { name: string }): void {
  if (!isRedisReady()) {
    console.error(`[queues] Redis offline — DLQ listener não anexado para "${queue.name}"`)
    return
  }
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
