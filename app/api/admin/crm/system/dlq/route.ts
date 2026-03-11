// app/api/admin/crm/system/dlq/route.ts — Lista jobs da DLQ
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { dlqQueue } from '@/lib/queues'

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const waitingJobs = await dlqQueue.getWaiting(0, 50)
    const completedJobs = await dlqQueue.getCompleted(0, 50)
    const allJobs = [...waitingJobs, ...completedJobs]

    const jobs = allJobs.map(job => ({
      id: job.id,
      name: job.name,
      data: job.data,
      timestamp: job.timestamp,
    }))

    // Ordenar por timestamp descendente
    jobs.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))

    return NextResponse.json({ jobs })
  } catch (err) {
    console.error('[dlq] GET error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ jobs: [] })
  }
}
