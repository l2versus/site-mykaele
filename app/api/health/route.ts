// GET /api/health — Health check para Coolify / monitoramento
// Retorna 200 se tudo OK, 503 se DB ou Redis offline
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redis, isRedisReady, connectRedis } from '@/lib/redis'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const timestamp = new Date().toISOString()
  let dbOk = false
  let redisOk = false

  // Testar PostgreSQL
  try {
    await prisma.$queryRawUnsafe('SELECT 1')
    dbOk = true
  } catch (err) {
    console.error('[health] DB check failed:', err instanceof Error ? err.message : err)
  }

  // Testar Redis
  try {
    if (!isRedisReady()) {
      await connectRedis()
    }
    if (isRedisReady()) {
      await redis.ping()
      redisOk = true
    }
  } catch (err) {
    console.error('[health] Redis check failed:', err instanceof Error ? err.message : err)
  }

  const status = dbOk && redisOk ? 'ok' : 'degraded'
  const httpStatus = dbOk ? 200 : 503 // DB é crítico, Redis é opcional

  return NextResponse.json(
    { status, db: dbOk, redis: redisOk, timestamp },
    { status: httpStatus },
  )
}
