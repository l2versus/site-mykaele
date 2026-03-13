// prisma/migrations/create_phase4_tables.mjs
// Migration manual — Fase 4: Bots + Webhooks Customizáveis
// Cria: CrmBotFlow, CrmBotSession, crm_webhooks_outgoing, crm_webhooks_incoming, crm_webhook_logs
// Idempotente — pode rodar múltiplas vezes sem risco.
//
// Uso: node prisma/migrations/create_phase4_tables.mjs

import pg from 'pg'
import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

async function run() {
  const client = await pool.connect()
  try {
    // ─────────────────────────────────────────────────────────
    // 1. CrmBotFlow — Fluxos de bot visual (React Flow)
    // ─────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS "CrmBotFlow" (
        "id"            TEXT NOT NULL DEFAULT gen_random_uuid(),
        "tenantId"      TEXT NOT NULL,
        "name"          TEXT NOT NULL,
        "description"   TEXT,
        "triggerType"   TEXT NOT NULL,
        "triggerConfig" JSONB,
        "nodes"         JSONB NOT NULL DEFAULT '[]'::jsonb,
        "edges"         JSONB NOT NULL DEFAULT '[]'::jsonb,
        "isActive"      BOOLEAN NOT NULL DEFAULT false,
        "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CrmBotFlow_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "CrmBotFlow_tenantId_fkey"
          FOREIGN KEY ("tenantId") REFERENCES "CrmTenant"("id") ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS "CrmBotFlow_tenantId_isActive_idx"
        ON "CrmBotFlow"("tenantId", "isActive");
      CREATE INDEX IF NOT EXISTS "CrmBotFlow_tenantId_triggerType_isActive_idx"
        ON "CrmBotFlow"("tenantId", "triggerType", "isActive");
    `)
    console.log('CrmBotFlow: OK')

    // ─────────────────────────────────────────────────────────
    // 2. CrmBotSession — Sessões ativas de bot por lead
    // ─────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS "CrmBotSession" (
        "id"              TEXT NOT NULL DEFAULT gen_random_uuid(),
        "tenantId"        TEXT NOT NULL,
        "flowId"          TEXT NOT NULL,
        "leadId"          TEXT NOT NULL,
        "currentNodeId"   TEXT NOT NULL,
        "status"          TEXT NOT NULL DEFAULT 'active',
        "data"            JSONB,
        "startedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "completedAt"     TIMESTAMP(3),
        "lastActivityAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CrmBotSession_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "CrmBotSession_tenantId_fkey"
          FOREIGN KEY ("tenantId") REFERENCES "CrmTenant"("id") ON DELETE CASCADE,
        CONSTRAINT "CrmBotSession_flowId_fkey"
          FOREIGN KEY ("flowId") REFERENCES "CrmBotFlow"("id") ON DELETE CASCADE,
        CONSTRAINT "CrmBotSession_leadId_fkey"
          FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE
      );

      CREATE UNIQUE INDEX IF NOT EXISTS "CrmBotSession_flowId_leadId_status_key"
        ON "CrmBotSession"("flowId", "leadId", "status");
      CREATE INDEX IF NOT EXISTS "CrmBotSession_tenantId_status_idx"
        ON "CrmBotSession"("tenantId", "status");
      CREATE INDEX IF NOT EXISTS "CrmBotSession_leadId_status_idx"
        ON "CrmBotSession"("leadId", "status");
    `)
    console.log('CrmBotSession: OK')

    // ─────────────────────────────────────────────────────────
    // 3. crm_webhooks_outgoing — Webhooks de saída
    // ─────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS crm_webhooks_outgoing (
        "id"        TEXT NOT NULL DEFAULT gen_random_uuid(),
        "tenantId"  TEXT NOT NULL,
        "name"      TEXT NOT NULL,
        "url"       TEXT NOT NULL,
        "events"    JSONB NOT NULL DEFAULT '[]'::jsonb,
        "headers"   JSONB,
        "isActive"  BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "crm_webhooks_outgoing_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "crm_webhooks_outgoing_tenantId_fkey"
          FOREIGN KEY ("tenantId") REFERENCES "CrmTenant"("id") ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS "crm_webhooks_outgoing_tenantId_isActive_idx"
        ON crm_webhooks_outgoing("tenantId", "isActive");
    `)
    console.log('crm_webhooks_outgoing: OK')

    // ─────────────────────────────────────────────────────────
    // 4. crm_webhooks_incoming — Webhooks de entrada (URLs únicas)
    // ─────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS crm_webhooks_incoming (
        "id"           TEXT NOT NULL DEFAULT gen_random_uuid(),
        "tenantId"     TEXT NOT NULL,
        "name"         TEXT NOT NULL,
        "token"        TEXT NOT NULL,
        "actionType"   TEXT NOT NULL,
        "actionConfig" JSONB,
        "isActive"     BOOLEAN NOT NULL DEFAULT true,
        "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "crm_webhooks_incoming_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "crm_webhooks_incoming_tenantId_fkey"
          FOREIGN KEY ("tenantId") REFERENCES "CrmTenant"("id") ON DELETE CASCADE
      );

      CREATE UNIQUE INDEX IF NOT EXISTS "crm_webhooks_incoming_token_key"
        ON crm_webhooks_incoming("token");
      CREATE INDEX IF NOT EXISTS "crm_webhooks_incoming_tenantId_isActive_idx"
        ON crm_webhooks_incoming("tenantId", "isActive");
    `)
    console.log('crm_webhooks_incoming: OK')

    // ─────────────────────────────────────────────────────────
    // 5. crm_webhook_logs — Logs de envio/recebimento
    // ─────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS crm_webhook_logs (
        "id"             TEXT NOT NULL DEFAULT gen_random_uuid(),
        "tenantId"       TEXT NOT NULL,
        "webhookId"      TEXT NOT NULL,
        "direction"      TEXT NOT NULL,
        "event"          TEXT NOT NULL,
        "payload"        JSONB,
        "responseStatus" INTEGER,
        "attempts"       INTEGER NOT NULL DEFAULT 1,
        "lastAttemptAt"  TIMESTAMP(3),
        "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "crm_webhook_logs_pkey" PRIMARY KEY ("id")
      );

      CREATE INDEX IF NOT EXISTS "crm_webhook_logs_tenantId_createdAt_idx"
        ON crm_webhook_logs("tenantId", "createdAt" DESC);
      CREATE INDEX IF NOT EXISTS "crm_webhook_logs_webhookId_idx"
        ON crm_webhook_logs("webhookId");
      CREATE INDEX IF NOT EXISTS "crm_webhook_logs_tenantId_direction_idx"
        ON crm_webhook_logs("tenantId", "direction");
    `)
    console.log('crm_webhook_logs: OK')

    // ─────────────────────────────────────────────────────────
    // 6. Verificações de dependência
    // ─────────────────────────────────────────────────────────
    const checks = ['CrmBotFlow', 'CrmBotSession', 'crm_webhooks_outgoing', 'crm_webhooks_incoming', 'crm_webhook_logs']
    for (const table of checks) {
      const result = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = $1
        ) as exists
      `, [table])
      const status = result.rows[0].exists ? 'exists' : 'MISSING'
      console.log(`  ${table}: ${status}`)
    }

    console.log('\n--- Phase 4 migration complete ---')
  } finally {
    client.release()
    await pool.end()
  }
}

run().catch(err => { console.error('Migration failed:', err); process.exit(1) })
