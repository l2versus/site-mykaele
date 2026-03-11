// app/api/admin/crm/system/stats/route.ts — Status do sistema: Redis, filas, DLQ e logs de automação
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redis, isRedisReady, connectRedis } from '@/lib/redis'
import { getInboxQueue, getAutomationQueue, getAiQueue, getDlqQueue } from '@/lib/queues'

interface QueueCounts {
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
}

async function getQueueCounts(queueName: string): Promise<QueueCounts> {
  if (!isRedisReady()) {
    return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 }
  }
  try {
    const queue = queueName === 'crm-inbox' ? getInboxQueue()
      : queueName === 'crm-automation' ? getAutomationQueue()
      : getAiQueue()

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ])
    return { waiting, active, completed, failed, delayed }
  } catch {
    return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 }
  }
}

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Tentar conectar Redis se ainda não conectou
    await connectRedis()
    const redisConnected = isRedisReady()

    // Redis memory info
    let memoryUsedMb = 0
    if (redisConnected) {
      try {
        const info = await redis.info('memory')
        const match = info.match(/used_memory:(\d+)/)
        if (match) memoryUsedMb = Math.round(Number(match[1]) / 1024 / 1024 * 100) / 100
      } catch { /* fallback: 0 */ }
    }

    // Queue counts (parallel)
    const [inbox, automation, ai] = await Promise.all([
      getQueueCounts('crm-inbox'),
      getQueueCounts('crm-automation'),
      getQueueCounts('crm-ai'),
    ])

    // DLQ jobs
    let dlqJobs: Array<{
      jobId: string
      originalQueue: string
      failedReason: string
      failedAt: string
      attemptsMade: number
      payload: unknown
    }> = []

    if (redisConnected) {
      try {
        const dlq = getDlqQueue()
        const waiting = await dlq.getWaiting(0, 50)
        dlqJobs = waiting.map(job => ({
          jobId: job.id ?? '',
          originalQueue: (job.data as Record<string, unknown>).originalQueue as string ?? 'unknown',
          failedReason: (job.data as Record<string, unknown>).reason as string ?? 'Motivo desconhecido',
          failedAt: (job.data as Record<string, unknown>).failedAt as string ?? new Date(job.timestamp).toISOString(),
          attemptsMade: job.attemptsMade ?? 0,
          payload: (job.data as Record<string, unknown>).payload ?? null,
        }))
      } catch { /* DLQ offline */ }
    }

    // Recent automation logs from Prisma
    const tenantSlug = req.nextUrl.searchParams.get('tenantId') || process.env.DEFAULT_TENANT_ID || 'clinica-mykaele-procopio'
    let resolvedTenantId = tenantSlug
    const tenant = await prisma.crmTenant.findUnique({ where: { slug: tenantSlug } })
    if (tenant) resolvedTenantId = tenant.id

    let recentLogs: Array<{
      id: string
      automationName: string
      status: string
      error: string | null
      executedAt: string
    }> = []

    try {
      const logs = await prisma.crmAutomationLog.findMany({
        where: { tenantId: resolvedTenantId },
        orderBy: { executedAt: 'desc' },
        take: 20,
        include: { automation: { select: { name: true } } },
      })
      recentLogs = logs.map(log => ({
        id: log.id,
        automationName: log.automation.name,
        status: log.status,
        error: log.error,
        executedAt: log.executedAt.toISOString(),
      }))
    } catch { /* tabela pode não existir ainda (pre-migration) */ }

    return NextResponse.json({
      redis: {
        status: redisConnected ? 'connected' : 'disconnected',
        memoryUsedMb,
      },
      queues: { inbox, automation, ai },
      dlq: dlqJobs,
      recentLogs,
    })
  } catch (err) {
    console.error('[system/stats] GET error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
