// app/api/admin/crm/system/dlq/requeue/route.ts — Reenfileirar job da DLQ
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { inboxQueue, automationQueue, aiQueue, dlqQueue } from '@/lib/queues'

const QUEUE_MAP: Record<string, typeof inboxQueue> = {
  'crm-inbox': inboxQueue,
  'crm-automation': automationQueue,
  'crm-ai': aiQueue,
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { jobId, originalQueue, payload: jobPayload } = await req.json()

    const targetQueue = QUEUE_MAP[originalQueue]
    if (!targetQueue) {
      return NextResponse.json({ error: `Fila desconhecida: ${originalQueue}` }, { status: 400 })
    }

    // Reenfileirar na fila original
    await targetQueue.add('requeued', jobPayload, {
      jobId: `requeue-${jobId}-${Date.now()}`,
    })

    // Remover da DLQ
    const dlqJob = await dlqQueue.getJob(jobId)
    if (dlqJob) {
      await dlqJob.remove()
    }

    return NextResponse.json({ ok: true, requeuedTo: originalQueue })
  } catch (err) {
    console.error('[dlq/requeue] POST error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro ao reenfileirar' }, { status: 500 })
  }
}
