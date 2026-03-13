// src/lib/presence.ts — Presença em tempo real da equipe
// Redis-first (SET com TTL 3min), fallback Postgres.
// Persiste no Postgres apenas quando o status muda (online→offline ou vice-versa).
import { redis, isRedisReady, safeRedis } from '@/lib/redis'
import { prisma } from '@/lib/prisma'

const PRESENCE_TTL = 180 // 3 minutos
const REDIS_KEY_PREFIX = 'user:presence:'

interface PresenceInfo {
  userId: string
  userName: string
  status: 'online' | 'offline'
  lastSeen: string
  currentPage?: string
}

/**
 * Registra heartbeat de presença.
 * Redis: SET user:presence:{userId} com TTL 3min
 * Postgres: só atualiza se status mudou (evita writes a cada 30s)
 */
export async function recordHeartbeat(params: {
  userId: string
  userName: string
  tenantId: string
  currentPage?: string
}): Promise<void> {
  const { userId, userName, tenantId, currentPage } = params
  const now = new Date().toISOString()

  const data = JSON.stringify({
    userId,
    userName,
    tenantId,
    status: 'online',
    lastSeen: now,
    currentPage: currentPage ?? '',
  })

  if (isRedisReady()) {
    // Redis: SET com TTL (auto-expira = auto-offline)
    const key = `${REDIS_KEY_PREFIX}${userId}`
    const prevRaw = await safeRedis(() => redis.get(key), null)

    await safeRedis(
      () => redis.set(key, data, 'EX', PRESENCE_TTL),
      undefined,
    )

    // Persist no Postgres apenas se estava offline antes (status mudou)
    if (!prevRaw) {
      await upsertPresenceDb({ userId, userName, tenantId, status: 'online', lastSeen: now })
    }
  } else {
    // Fallback: direto no Postgres
    await upsertPresenceDb({ userId, userName, tenantId, status: 'online', lastSeen: now })
  }
}

/**
 * Lista usuários online do tenant.
 * Redis: scan user:presence:* e filtrar por tenantId.
 * Postgres fallback: query CrmPresence where lastSeen > now - 3min.
 */
export async function getOnlineUsers(tenantId: string): Promise<PresenceInfo[]> {
  if (isRedisReady()) {
    const keys = await safeRedis(
      () => scanKeys(`${REDIS_KEY_PREFIX}*`),
      [] as string[],
    )

    if (keys.length === 0) {
      // Fallback ao Postgres quando Redis não tem dados
      return getOnlineFromDb(tenantId)
    }

    const pipeline = redis.pipeline()
    for (const key of keys) {
      pipeline.get(key)
    }
    const results = await safeRedis(() => pipeline.exec(), null)
    if (!results) return getOnlineFromDb(tenantId)

    const online: PresenceInfo[] = []
    for (const [err, val] of results) {
      if (err || !val) continue
      try {
        const parsed = JSON.parse(val as string)
        if (parsed.tenantId === tenantId) {
          online.push({
            userId: parsed.userId,
            userName: parsed.userName,
            status: 'online',
            lastSeen: parsed.lastSeen,
            currentPage: parsed.currentPage,
          })
        }
      } catch {
        // skip malformed
      }
    }
    return online
  }

  return getOnlineFromDb(tenantId)
}

/**
 * Marca usuário como offline.
 */
export async function markOffline(userId: string, tenantId: string): Promise<void> {
  if (isRedisReady()) {
    await safeRedis(
      () => redis.del(`${REDIS_KEY_PREFIX}${userId}`),
      undefined,
    )
  }

  // Sempre atualizar Postgres quando sai explicitamente
  await prisma.crmAuditLog.findFirst({ where: { tenantId } }).then(() => {
    // Tenant exists, safe to update
    prisma.$executeRawUnsafe(
      `UPDATE "CrmPresence" SET status = 'offline', "lastSeen" = NOW() WHERE "userId" = $1 AND "tenantId" = $2`,
      userId, tenantId,
    ).catch(() => { /* table may not exist yet */ })
  }).catch(() => {})
}

// ━━━ Helpers ━━━

async function scanKeys(pattern: string): Promise<string[]> {
  const keys: string[] = []
  let cursor = '0'
  do {
    const [nextCursor, results] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100)
    cursor = nextCursor
    keys.push(...results)
  } while (cursor !== '0')
  return keys
}

async function upsertPresenceDb(params: {
  userId: string; userName: string; tenantId: string; status: string; lastSeen: string
}): Promise<void> {
  const { userId, userName, tenantId, status, lastSeen } = params
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "CrmPresence" ("id", "userId", "userName", "tenantId", "status", "lastSeen", "createdAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5::timestamp, NOW())
       ON CONFLICT ("userId", "tenantId")
       DO UPDATE SET status = $4, "lastSeen" = $5::timestamp, "userName" = $2`,
      userId, userName, tenantId, status, lastSeen,
    )
  } catch {
    // CrmPresence table may not exist yet — will be created in 5.7 migration
  }
}

async function getOnlineFromDb(tenantId: string): Promise<PresenceInfo[]> {
  try {
    const cutoff = new Date(Date.now() - PRESENCE_TTL * 1000).toISOString()
    const results = await prisma.$queryRawUnsafe<Array<{
      userId: string; userName: string; status: string; lastSeen: Date
    }>>(
      `SELECT "userId", "userName", status, "lastSeen" FROM "CrmPresence"
       WHERE "tenantId" = $1 AND "lastSeen" > $2::timestamp AND status = 'online'`,
      tenantId, cutoff,
    )
    return results.map(r => ({
      userId: r.userId,
      userName: r.userName,
      status: 'online' as const,
      lastSeen: new Date(r.lastSeen).toISOString(),
    }))
  } catch {
    return [] // Table doesn't exist yet
  }
}
