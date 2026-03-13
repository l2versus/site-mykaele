// prisma/migrations/create-phase3-tables.mjs
// Migration manual — Fase 3 COMPLETA: todas as tabelas CRM v8.1–v8.6
//
// Cria (IF NOT EXISTS):
//   CrmAutomationLog, CrmNotification, CrmNotificationSetting,
//   CrmAiConfig, CrmTask, CrmTemplate,
//   CrmBroadcast, CrmBroadcastRecipient,
//   CrmNpsConfig, CrmNpsResponse,
//   CrmProposal, CrmProposalItem,
//   CrmTeamMember (+ Lead.assignedToUserId),
//   CrmActivityLog, CrmMarketingSpend, CrmGoal
//
// Uso: node prisma/migrations/create-phase3-tables.mjs

import pg from 'pg'
import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

async function tableExists(client, tableName) {
  const res = await client.query(
    `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1) AS exists`,
    [tableName]
  )
  return res.rows[0].exists
}

async function createTable(client, name, sql) {
  const existed = await tableExists(client, name)
  await client.query(sql)
  if (existed) {
    console.log(`  ${name}: already existed (indexes ensured)`)
  } else {
    console.log(`  ${name}: CREATED`)
  }
}

async function run() {
  const client = await pool.connect()
  try {
    console.log('=== Phase 3 Complete Migration ===\n')

    // 0. pgvector (silent fail)
    try {
      await client.query(`CREATE EXTENSION IF NOT EXISTS vector;`)
      console.log('[ext] pgvector: OK')
    } catch (err) {
      console.warn('[ext] pgvector: NOT AVAILABLE —', err.message)
    }

    // 1. CrmAutomationLog
    await createTable(client, 'CrmAutomationLog', `
      CREATE TABLE IF NOT EXISTS "CrmAutomationLog" (
        "id"           TEXT NOT NULL DEFAULT gen_random_uuid(),
        "tenantId"     TEXT NOT NULL,
        "automationId" TEXT NOT NULL,
        "status"       TEXT NOT NULL,
        "error"        TEXT,
        "jobId"        TEXT,
        "payload"      JSONB,
        "executedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CrmAutomationLog_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "CrmAutomationLog_tenantId_fkey"
          FOREIGN KEY ("tenantId") REFERENCES "CrmTenant"("id") ON DELETE CASCADE,
        CONSTRAINT "CrmAutomationLog_automationId_fkey"
          FOREIGN KEY ("automationId") REFERENCES "CrmAutomation"("id") ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS "CrmAutomationLog_tenantId_executedAt_idx"
        ON "CrmAutomationLog"("tenantId", "executedAt" DESC);
      CREATE INDEX IF NOT EXISTS "CrmAutomationLog_automationId_idx"
        ON "CrmAutomationLog"("automationId");
    `)

    // 2. CrmNotification
    await createTable(client, 'CrmNotification', `
      CREATE TABLE IF NOT EXISTS "CrmNotification" (
        "id"         TEXT NOT NULL DEFAULT gen_random_uuid(),
        "tenantId"   TEXT NOT NULL,
        "userId"     TEXT NOT NULL,
        "type"       TEXT NOT NULL,
        "title"      TEXT NOT NULL,
        "message"    TEXT NOT NULL,
        "entityId"   TEXT,
        "entityType" TEXT,
        "isRead"     BOOLEAN NOT NULL DEFAULT false,
        "readAt"     TIMESTAMP(3),
        "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CrmNotification_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "CrmNotification_tenantId_fkey"
          FOREIGN KEY ("tenantId") REFERENCES "CrmTenant"("id") ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS "CrmNotification_tenantId_userId_isRead_idx"
        ON "CrmNotification"("tenantId", "userId", "isRead");
      CREATE INDEX IF NOT EXISTS "CrmNotification_tenantId_userId_createdAt_idx"
        ON "CrmNotification"("tenantId", "userId", "createdAt" DESC);
    `)

    // 3. CrmNotificationSetting
    await createTable(client, 'CrmNotificationSetting', `
      CREATE TABLE IF NOT EXISTS "CrmNotificationSetting" (
        "id"        TEXT NOT NULL DEFAULT gen_random_uuid(),
        "tenantId"  TEXT NOT NULL,
        "userId"    TEXT NOT NULL,
        "event"     TEXT NOT NULL,
        "channel"   TEXT NOT NULL,
        "isEnabled" BOOLEAN NOT NULL DEFAULT true,
        CONSTRAINT "CrmNotificationSetting_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "CrmNotificationSetting_tenantId_fkey"
          FOREIGN KEY ("tenantId") REFERENCES "CrmTenant"("id") ON DELETE CASCADE
      );

      CREATE UNIQUE INDEX IF NOT EXISTS "CrmNotificationSetting_tenantId_userId_event_channel_key"
        ON "CrmNotificationSetting"("tenantId", "userId", "event", "channel");
      CREATE INDEX IF NOT EXISTS "CrmNotificationSetting_tenantId_userId_idx"
        ON "CrmNotificationSetting"("tenantId", "userId");
    `)

    // 4. CrmAiConfig
    await createTable(client, 'CrmAiConfig', `
      CREATE TABLE IF NOT EXISTS "CrmAiConfig" (
        "id"                   TEXT NOT NULL DEFAULT gen_random_uuid(),
        "tenantId"             TEXT NOT NULL,
        "provider"             TEXT NOT NULL DEFAULT 'openai',
        "model"                TEXT NOT NULL DEFAULT 'gpt-4o-mini',
        "temperature"          DOUBLE PRECISION NOT NULL DEFAULT 0.7,
        "maxTokens"            INTEGER NOT NULL DEFAULT 1024,
        "systemPrompt"         TEXT,
        "isActive"             BOOLEAN NOT NULL DEFAULT false,
        "conciergeGreeting"    TEXT,
        "conciergePersona"     TEXT,
        "autoScoreEnabled"     BOOLEAN NOT NULL DEFAULT true,
        "autoSentimentEnabled" BOOLEAN NOT NULL DEFAULT false,
        "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CrmAiConfig_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "CrmAiConfig_tenantId_fkey"
          FOREIGN KEY ("tenantId") REFERENCES "CrmTenant"("id") ON DELETE CASCADE
      );

      CREATE UNIQUE INDEX IF NOT EXISTS "CrmAiConfig_tenantId_key"
        ON "CrmAiConfig"("tenantId");
    `)

    // 5. CrmTask
    await createTable(client, 'CrmTask', `
      CREATE TABLE IF NOT EXISTS "CrmTask" (
        "id"               TEXT NOT NULL DEFAULT gen_random_uuid(),
        "tenantId"         TEXT NOT NULL,
        "leadId"           TEXT,
        "assignedToUserId" TEXT NOT NULL,
        "title"            TEXT NOT NULL,
        "description"      TEXT,
        "dueAt"            TIMESTAMP(3),
        "completedAt"      TIMESTAMP(3),
        "priority"         INTEGER NOT NULL DEFAULT 0,
        "status"           TEXT NOT NULL DEFAULT 'PENDING',
        "createdBy"        TEXT,
        "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CrmTask_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "CrmTask_tenantId_fkey"
          FOREIGN KEY ("tenantId") REFERENCES "CrmTenant"("id") ON DELETE CASCADE,
        CONSTRAINT "CrmTask_leadId_fkey"
          FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS "CrmTask_tenantId_assignedToUserId_status_idx"
        ON "CrmTask"("tenantId", "assignedToUserId", "status");
      CREATE INDEX IF NOT EXISTS "CrmTask_tenantId_dueAt_idx"
        ON "CrmTask"("tenantId", "dueAt");
      CREATE INDEX IF NOT EXISTS "CrmTask_tenantId_leadId_idx"
        ON "CrmTask"("tenantId", "leadId");
    `)

    // 6. CrmTemplate
    await createTable(client, 'CrmTemplate', `
      CREATE TABLE IF NOT EXISTS "CrmTemplate" (
        "id"        TEXT NOT NULL DEFAULT gen_random_uuid(),
        "tenantId"  TEXT NOT NULL,
        "type"      TEXT NOT NULL,
        "name"      TEXT NOT NULL,
        "category"  TEXT NOT NULL DEFAULT 'geral',
        "subject"   TEXT,
        "content"   TEXT NOT NULL,
        "variables" TEXT[] DEFAULT '{}',
        "isActive"  BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CrmTemplate_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "CrmTemplate_tenantId_fkey"
          FOREIGN KEY ("tenantId") REFERENCES "CrmTenant"("id") ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS "CrmTemplate_tenantId_type_isActive_idx"
        ON "CrmTemplate"("tenantId", "type", "isActive");
      CREATE INDEX IF NOT EXISTS "CrmTemplate_tenantId_category_idx"
        ON "CrmTemplate"("tenantId", "category");
    `)

    // 7. CrmBroadcast
    await createTable(client, 'CrmBroadcast', `
      CREATE TABLE IF NOT EXISTS "CrmBroadcast" (
        "id"              TEXT NOT NULL DEFAULT gen_random_uuid(),
        "tenantId"        TEXT NOT NULL,
        "name"            TEXT NOT NULL,
        "templateId"      TEXT,
        "message"         TEXT NOT NULL,
        "filters"         JSONB,
        "totalRecipients" INTEGER NOT NULL DEFAULT 0,
        "sent"            INTEGER NOT NULL DEFAULT 0,
        "delivered"       INTEGER NOT NULL DEFAULT 0,
        "read"            INTEGER NOT NULL DEFAULT 0,
        "failed"          INTEGER NOT NULL DEFAULT 0,
        "status"          TEXT NOT NULL DEFAULT 'DRAFT',
        "createdBy"       TEXT NOT NULL,
        "startedAt"       TIMESTAMP(3),
        "completedAt"     TIMESTAMP(3),
        "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CrmBroadcast_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "CrmBroadcast_tenantId_fkey"
          FOREIGN KEY ("tenantId") REFERENCES "CrmTenant"("id") ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS "CrmBroadcast_tenantId_status_idx"
        ON "CrmBroadcast"("tenantId", "status");
      CREATE INDEX IF NOT EXISTS "CrmBroadcast_tenantId_createdAt_idx"
        ON "CrmBroadcast"("tenantId", "createdAt" DESC);
    `)

    // 8. CrmBroadcastRecipient
    await createTable(client, 'CrmBroadcastRecipient', `
      CREATE TABLE IF NOT EXISTS "CrmBroadcastRecipient" (
        "id"           TEXT NOT NULL DEFAULT gen_random_uuid(),
        "broadcastId"  TEXT NOT NULL,
        "leadId"       TEXT NOT NULL,
        "leadName"     TEXT NOT NULL,
        "phone"        TEXT NOT NULL,
        "status"       TEXT NOT NULL DEFAULT 'PENDING',
        "sentAt"       TIMESTAMP(3),
        "errorMessage" TEXT,
        CONSTRAINT "CrmBroadcastRecipient_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "CrmBroadcastRecipient_broadcastId_fkey"
          FOREIGN KEY ("broadcastId") REFERENCES "CrmBroadcast"("id") ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS "CrmBroadcastRecipient_broadcastId_status_idx"
        ON "CrmBroadcastRecipient"("broadcastId", "status");
      CREATE INDEX IF NOT EXISTS "CrmBroadcastRecipient_broadcastId_idx"
        ON "CrmBroadcastRecipient"("broadcastId");
    `)

    // 9. CrmNpsConfig
    await createTable(client, 'CrmNpsConfig', `
      CREATE TABLE IF NOT EXISTS "CrmNpsConfig" (
        "id"                TEXT NOT NULL DEFAULT gen_random_uuid(),
        "tenantId"          TEXT NOT NULL,
        "isActive"          BOOLEAN NOT NULL DEFAULT false,
        "triggerType"       TEXT NOT NULL DEFAULT 'manual',
        "triggerStageId"    TEXT,
        "templateMessage"   TEXT NOT NULL DEFAULT 'Olá {{nome}}! De 0 a 10, o quanto você recomendaria nosso serviço? Responda apenas com o número.',
        "thankYouPromoter"  TEXT NOT NULL DEFAULT 'Muito obrigado pela avaliação! Ficamos felizes com sua satisfação. Considere nos avaliar no Google!',
        "thankYouNeutral"   TEXT NOT NULL DEFAULT 'Obrigado pelo feedback! Vamos trabalhar para melhorar ainda mais.',
        "thankYouDetractor" TEXT NOT NULL DEFAULT 'Lamentamos que sua experiência não tenha sido ideal. Como podemos melhorar?',
        "cooldownDays"      INTEGER NOT NULL DEFAULT 30,
        CONSTRAINT "CrmNpsConfig_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "CrmNpsConfig_tenantId_fkey"
          FOREIGN KEY ("tenantId") REFERENCES "CrmTenant"("id") ON DELETE CASCADE
      );

      CREATE UNIQUE INDEX IF NOT EXISTS "CrmNpsConfig_tenantId_key"
        ON "CrmNpsConfig"("tenantId");
    `)

    // 10. CrmNpsResponse
    await createTable(client, 'CrmNpsResponse', `
      CREATE TABLE IF NOT EXISTS "CrmNpsResponse" (
        "id"          TEXT NOT NULL DEFAULT gen_random_uuid(),
        "tenantId"    TEXT NOT NULL,
        "leadId"      TEXT NOT NULL,
        "leadName"    TEXT NOT NULL,
        "score"       INTEGER NOT NULL,
        "category"    TEXT NOT NULL,
        "feedback"    TEXT,
        "triggeredBy" TEXT,
        "sentAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "respondedAt" TIMESTAMP(3),
        "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CrmNpsResponse_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "CrmNpsResponse_tenantId_fkey"
          FOREIGN KEY ("tenantId") REFERENCES "CrmTenant"("id") ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS "CrmNpsResponse_tenantId_createdAt_idx"
        ON "CrmNpsResponse"("tenantId", "createdAt" DESC);
      CREATE INDEX IF NOT EXISTS "CrmNpsResponse_tenantId_category_idx"
        ON "CrmNpsResponse"("tenantId", "category");
      CREATE INDEX IF NOT EXISTS "CrmNpsResponse_tenantId_leadId_idx"
        ON "CrmNpsResponse"("tenantId", "leadId");
    `)

    // 11. CrmProposal
    await createTable(client, 'CrmProposal', `
      CREATE TABLE IF NOT EXISTS "CrmProposal" (
        "id"           TEXT NOT NULL DEFAULT gen_random_uuid(),
        "tenantId"     TEXT NOT NULL,
        "leadId"       TEXT NOT NULL,
        "leadName"     TEXT NOT NULL,
        "title"        TEXT NOT NULL,
        "description"  TEXT,
        "discount"     DOUBLE PRECISION NOT NULL DEFAULT 0,
        "discountType" TEXT NOT NULL DEFAULT 'percent',
        "totalValue"   DOUBLE PRECISION NOT NULL DEFAULT 0,
        "validUntil"   TIMESTAMP(3),
        "status"       TEXT NOT NULL DEFAULT 'DRAFT',
        "publicToken"  TEXT NOT NULL DEFAULT gen_random_uuid(),
        "sentAt"       TIMESTAMP(3),
        "viewedAt"     TIMESTAMP(3),
        "respondedAt"  TIMESTAMP(3),
        "createdBy"    TEXT NOT NULL,
        "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CrmProposal_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "CrmProposal_tenantId_fkey"
          FOREIGN KEY ("tenantId") REFERENCES "CrmTenant"("id") ON DELETE CASCADE
      );

      CREATE UNIQUE INDEX IF NOT EXISTS "CrmProposal_publicToken_key"
        ON "CrmProposal"("publicToken");
      CREATE INDEX IF NOT EXISTS "CrmProposal_tenantId_leadId_idx"
        ON "CrmProposal"("tenantId", "leadId");
      CREATE INDEX IF NOT EXISTS "CrmProposal_tenantId_status_idx"
        ON "CrmProposal"("tenantId", "status");
      CREATE INDEX IF NOT EXISTS "CrmProposal_publicToken_idx"
        ON "CrmProposal"("publicToken");
    `)

    // 12. CrmProposalItem
    await createTable(client, 'CrmProposalItem', `
      CREATE TABLE IF NOT EXISTS "CrmProposalItem" (
        "id"          TEXT NOT NULL DEFAULT gen_random_uuid(),
        "proposalId"  TEXT NOT NULL,
        "name"        TEXT NOT NULL,
        "description" TEXT,
        "quantity"    INTEGER NOT NULL DEFAULT 1,
        "unitPrice"   DOUBLE PRECISION NOT NULL,
        "sortOrder"   INTEGER NOT NULL DEFAULT 0,
        CONSTRAINT "CrmProposalItem_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "CrmProposalItem_proposalId_fkey"
          FOREIGN KEY ("proposalId") REFERENCES "CrmProposal"("id") ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS "CrmProposalItem_proposalId_idx"
        ON "CrmProposalItem"("proposalId");
    `)

    // 13. CrmTeamMember (also handled by manual_add_team_members.mjs, but include for completeness)
    await createTable(client, 'CrmTeamMember', `
      CREATE TABLE IF NOT EXISTS "CrmTeamMember" (
        "id"        TEXT NOT NULL DEFAULT gen_random_uuid(),
        "tenantId"  TEXT NOT NULL,
        "userId"    TEXT,
        "name"      TEXT NOT NULL,
        "email"     TEXT NOT NULL,
        "phone"     TEXT,
        "role"      TEXT NOT NULL DEFAULT 'agent',
        "avatar"    TEXT,
        "isActive"  BOOLEAN NOT NULL DEFAULT true,
        "invitedBy" TEXT,
        "joinedAt"  TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CrmTeamMember_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "CrmTeamMember_tenantId_fkey"
          FOREIGN KEY ("tenantId") REFERENCES "CrmTenant"("id") ON DELETE CASCADE
      );

      CREATE UNIQUE INDEX IF NOT EXISTS "CrmTeamMember_tenantId_email_key"
        ON "CrmTeamMember"("tenantId", "email");
      CREATE INDEX IF NOT EXISTS "CrmTeamMember_tenantId_isActive_idx"
        ON "CrmTeamMember"("tenantId", "isActive");
      CREATE INDEX IF NOT EXISTS "CrmTeamMember_tenantId_role_idx"
        ON "CrmTeamMember"("tenantId", "role");
    `)

    // 14. Lead.assignedToUserId (safe add)
    try {
      await client.query(`
        DO $$ BEGIN
          ALTER TABLE "Lead" ADD COLUMN "assignedToUserId" TEXT;
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$;
        CREATE INDEX IF NOT EXISTS "Lead_tenantId_assignedToUserId_idx"
          ON "Lead"("tenantId", "assignedToUserId");
      `)
      console.log('  Lead.assignedToUserId: ensured')
    } catch (err) {
      console.warn('  Lead.assignedToUserId: skipped —', err.message)
    }

    // 15. CrmActivityLog
    await createTable(client, 'CrmActivityLog', `
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

    // 16. CrmMarketingSpend
    await createTable(client, 'CrmMarketingSpend', `
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

    // 17. CrmGoal
    await createTable(client, 'CrmGoal', `
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

    // === Summary ===
    console.log('\n--- Validating all tables ---')
    const allTables = [
      'CrmAutomationLog', 'CrmNotification', 'CrmNotificationSetting',
      'CrmAiConfig', 'CrmTask', 'CrmTemplate',
      'CrmBroadcast', 'CrmBroadcastRecipient',
      'CrmNpsConfig', 'CrmNpsResponse',
      'CrmProposal', 'CrmProposalItem',
      'CrmTeamMember', 'CrmActivityLog', 'CrmMarketingSpend', 'CrmGoal',
    ]
    let ok = 0
    for (const t of allTables) {
      const exists = await tableExists(client, t)
      if (exists) { ok++ } else { console.error(`  MISSING: ${t}`) }
    }
    console.log(`\n=== ${ok}/${allTables.length} tables verified ===`)
    if (ok < allTables.length) {
      console.error('Some tables failed to create. Check errors above.')
      process.exit(1)
    }
    console.log('Phase 3 complete migration finished successfully.')

  } finally {
    client.release()
    await pool.end()
  }
}

run().catch(err => { console.error('Migration failed:', err); process.exit(1) })
