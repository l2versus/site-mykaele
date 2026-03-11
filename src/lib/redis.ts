// src/lib/redis.ts — Conexão Redis centralizada com graceful degradation
// Se o Redis estiver offline, o app NÃO crasheia — apenas as filas e SSE ficam inoperantes.
import IORedis from 'ioredis'

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379'

// Estado global para evitar múltiplas instâncias em dev (HMR do Next.js)
declare global {
  var redisGlobal: IORedis | undefined
  var redisReady: boolean
}

function createRedisClient(): IORedis {
  const client = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,  // obrigatório para BullMQ
    enableReadyCheck: true,
    lazyConnect: true,           // não conecta no import — só quando usado
    retryStrategy(times) {
      // Tenta reconectar com backoff exponencial até 30s
      if (times > 20) return null // para de tentar após ~20 falhas
      return Math.min(times * 500, 30_000)
    },
    reconnectOnError(err) {
      // Reconecta apenas em erros de conexão, não em erros de comando
      return err.message.includes('READONLY') || err.message.includes('ECONNRESET')
    },
  })

  client.on('connect', () => {
    globalThis.redisReady = true
    console.error('[redis] Conectado com sucesso')
  })

  client.on('ready', () => {
    globalThis.redisReady = true
  })

  client.on('error', (err) => {
    globalThis.redisReady = false
    // Loga apenas a mensagem, sem stack trace gigante em loop
    console.error('[redis] Erro de conexão:', err.message)
  })

  client.on('close', () => {
    globalThis.redisReady = false
  })

  return client
}

// Singleton — reutiliza a mesma instância em dev (HMR)
export const redis: IORedis = globalThis.redisGlobal ?? createRedisClient()

if (process.env.NODE_ENV !== 'production') {
  globalThis.redisGlobal = redis
}

/** Verifica se o Redis está conectado e pronto para receber comandos */
export function isRedisReady(): boolean {
  return globalThis.redisReady === true && redis.status === 'ready'
}

/**
 * Conecta ao Redis de forma segura.
 * Retorna true se conectou, false se falhou (sem throw).
 */
export async function connectRedis(): Promise<boolean> {
  if (redis.status === 'ready') return true
  if (redis.status === 'connecting') {
    // Já está tentando — espera um pouco
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), 5_000)
      redis.once('ready', () => { clearTimeout(timeout); resolve(true) })
      redis.once('error', () => { clearTimeout(timeout); resolve(false) })
    })
  }
  try {
    await redis.connect()
    return true
  } catch {
    console.error('[redis] Falha ao conectar — filas e SSE desativados')
    return false
  }
}

/**
 * Wrapper seguro para operações Redis.
 * Se Redis offline, retorna o fallback sem crashear.
 */
export async function safeRedis<T>(
  operation: () => Promise<T>,
  fallback: T
): Promise<T> {
  if (!isRedisReady()) return fallback
  try {
    return await operation()
  } catch (err) {
    console.error('[redis] Operação falhou:', (err as Error).message)
    return fallback
  }
}

// Parse da URL para BullMQ (precisa de host/port separados)
export function parseBullConnection() {
  const parsed = new URL(redisUrl)
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 6379,
    password: parsed.password || undefined,
    db: parsed.pathname ? Number(parsed.pathname.slice(1)) || 0 : 0,
    maxRetriesPerRequest: null as null,
  }
}
