import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const { Pool } = pg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Limites seguros para Coolify/VPS — evita connection leaks
  max: 10,                    // máximo de conexões no pool
  idleTimeoutMillis: 30_000,  // fecha conexão ociosa após 30s
  connectionTimeoutMillis: 5_000, // timeout para adquirir conexão
})

// Log de erro do pool (não derruba o app, apenas loga)
pool.on('error', (err) => {
  console.error('[prisma/pool] Erro inesperado no pool PostgreSQL:', err.message)
})

const adapter = new PrismaPg(pool)

const prismaClientSingleton = () => {
  return new PrismaClient({ adapter })
}

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

export { prisma }
export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma

// ============================================================
// HELPER pgvector — Busca semântica na base de conhecimento CRM
// ============================================================
export async function findSimilarChunks(
  tenantId: string,
  embedding: number[],
  limit = 5,
  threshold = 0.75
) {
  return prisma.$queryRaw<Array<{
    id: string; title: string; content: string; similarity: number
  }>>`
    SELECT id, title, content,
           1 - (embedding <=> ${embedding}::vector) AS similarity
    FROM   "CrmKnowledgeBase"
    WHERE  "tenantId" = ${tenantId}
      AND  "isActive" = true
      AND  embedding IS NOT NULL
      AND  1 - (embedding <=> ${embedding}::vector) > ${threshold}
    ORDER  BY similarity DESC
    LIMIT  ${limit}
  `
}