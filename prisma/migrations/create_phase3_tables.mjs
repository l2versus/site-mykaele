// prisma/migrations/create_phase3_tables.mjs
// Migration manual — Fase 3: Relatórios e Analytics
// Cria: CrmActivityLog, CrmMarketingSpend, CrmGoal
// + tenta habilitar pgvector (falha silenciosa se não disponível)
//
// Uso: node prisma/migrations/create_phase3_tables.mjs

import pg from 'pg'
import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

async function run() {
  const client = await pool.connect()
  try {
    // 1. Tentar habilitar pgvector (silencioso se não disponível)
    try {
      await client.query(`CREATE EXTENSION IF NOT EXISTS vector;`)
      console.log('pgvector extension: OK')
    } catch (err) {
      console.warn('pgvector extension: NOT AVAILABLE (skipping) —', err.message)
      console.warn('RAG/embeddings features will not work until pgvector is installed on the server.')
    }

    // 2. CrmActivityLog — Log de atividades para relatórios
    await client.query(`
      CREATE TABLE IF NOT EXISTS "CrmActivityLog" (
        "id"          TEXT NOT NULL DEFAULT gen_random_uuid(),
        "tenantId"    TEXT NOT NULL,
        "type"        TEXT NOT NULL,
        "description" TEXT NOT NULL,
        "leadId"      TEXT,
        "userId"      TEXT,
        "metadata"    JSONB,
        "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CrmActivityLog_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "CrmActivityLog_tenantId_fkey"
          FOREIGN KEY ("tenantId") REFERENCES "CrmTenant"("id") ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS "CrmActivityLog_tenantId_createdAt_idx"
        ON "CrmActivityLog"("tenantId", "createdAt" DESC);
      CREATE INDEX IF NOT EXISTS "CrmActivityLog_tenantId_type_idx"
        ON "CrmActivityLog"("tenantId", "type");
      CREATE INDEX IF NOT EXISTS "CrmActivityLog_tenantId_leadId_idx"
        ON "CrmActivityLog"("tenantId", "leadId");
      CREATE INDEX IF NOT EXISTS "CrmActivityLog_tenantId_userId_idx"
        ON "CrmActivityLog"("tenantId", "userId");
    `)
    console.log('CrmActivityLog: OK')

    // 3. CrmMarketingSpend — Investimento em marketing (ROI)
    await client.query(`
      CREATE TABLE IF NOT EXISTS "CrmMarketingSpend" (
        "id"        TEXT NOT NULL DEFAULT gen_random_uuid(),
        "tenantId"  TEXT NOT NULL,
        "month"     INTEGER NOT NULL,
        "year"      INTEGER NOT NULL,
        "amount"    DOUBLE PRECISION NOT NULL,
        "source"    TEXT NOT NULL,
        "notes"     TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CrmMarketingSpend_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "CrmMarketingSpend_tenantId_fkey"
          FOREIGN KEY ("tenantId") REFERENCES "CrmTenant"("id") ON DELETE CASCADE
      );

      CREATE UNIQUE INDEX IF NOT EXISTS "CrmMarketingSpend_tenantId_month_year_source_key"
        ON "CrmMarketingSpend"("tenantId", "month", "year", "source");
      CREATE INDEX IF NOT EXISTS "CrmMarketingSpend_tenantId_year_month_idx"
        ON "CrmMarketingSpend"("tenantId", "year", "month");
    `)
    console.log('CrmMarketingSpend: OK')

    // 4. CrmGoal — Metas mensais
    await client.query(`
      CREATE TABLE IF NOT EXISTS "CrmGoal" (
        "id"          TEXT NOT NULL DEFAULT gen_random_uuid(),
        "tenantId"    TEXT NOT NULL,
        "type"        TEXT NOT NULL,
        "targetValue" DOUBLE PRECISION NOT NULL,
        "month"       INTEGER NOT NULL,
        "year"        INTEGER NOT NULL,
        "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CrmGoal_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "CrmGoal_tenantId_fkey"
          FOREIGN KEY ("tenantId") REFERENCES "CrmTenant"("id") ON DELETE CASCADE
      );

      CREATE UNIQUE INDEX IF NOT EXISTS "CrmGoal_tenantId_type_month_year_key"
        ON "CrmGoal"("tenantId", "type", "month", "year");
      CREATE INDEX IF NOT EXISTS "CrmGoal_tenantId_year_month_idx"
        ON "CrmGoal"("tenantId", "year", "month");
    `)
    console.log('CrmGoal: OK')

    // 5. Verificar se CrmNpsResponse existe (usado pelo goals report)
    const npsCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'CrmNpsResponse'
      ) as exists
    `)
    if (!npsCheck.rows[0].exists) {
      console.warn('CrmNpsResponse: table not found (NPS goals will show 0)')
    } else {
      console.log('CrmNpsResponse: exists')
    }

    console.log('\n--- Phase 3 migration complete ---')
  } finally {
    client.release()
    await pool.end()
  }
}

run().catch(err => { console.error('Migration failed:', err); process.exit(1) })
