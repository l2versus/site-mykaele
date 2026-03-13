// prisma/migrations/create_phase6_multichannel.mjs
// Migration manual — Fase 6: Multi-canal e Central de Integrações
// - Coluna `channel` na tabela Message (whatsapp, instagram, facebook, telegram, email)
// - Índice em Message(tenantId, channel)
// - Coluna `sentByUserId` na tabela Message (quem enviou pelo CRM)
// Idempotente — pode rodar múltiplas vezes sem risco.
//
// Uso: node prisma/migrations/create_phase6_multichannel.mjs

import pg from 'pg'
import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

async function run() {
  const client = await pool.connect()
  try {
    console.log('=== Fase 6: Multi-canal e Central de Integrações ===\n')

    // ─────────────────────────────────────────────────────────
    // 1. Coluna `channel` em Message (default: 'whatsapp')
    // ─────────────────────────────────────────────────────────
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'Message' AND column_name = 'channel'
        ) THEN
          ALTER TABLE "Message" ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'whatsapp';
        END IF;
      END $$;
    `)
    console.log('1. Message.channel column: OK')

    // ─────────────────────────────────────────────────────────
    // 2. Índice em Message(tenantId, channel) para filtro por canal
    // ─────────────────────────────────────────────────────────
    await client.query(`
      CREATE INDEX IF NOT EXISTS "Message_tenantId_channel_idx"
      ON "Message" ("tenantId", "channel");
    `)
    console.log('2. Message(tenantId, channel) index: OK')

    // ─────────────────────────────────────────────────────────
    // 3. Coluna `sentByUserId` em Message (quem enviou pelo CRM)
    // ─────────────────────────────────────────────────────────
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'Message' AND column_name = 'sentByUserId'
        ) THEN
          ALTER TABLE "Message" ADD COLUMN "sentByUserId" TEXT;
        END IF;
      END $$;
    `)
    console.log('3. Message.sentByUserId column: OK')

    // ─────────────────────────────────────────────────────────
    // 4. Coluna `sentiment` em Message (análise de sentimento IA)
    // ─────────────────────────────────────────────────────────
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'Message' AND column_name = 'sentiment'
        ) THEN
          ALTER TABLE "Message" ADD COLUMN "sentiment" TEXT;
        END IF;
      END $$;
    `)
    console.log('4. Message.sentiment column: OK')

    // ─────────────────────────────────────────────────────────
    // 5. Coluna `readAt` em Message (timestamp de leitura)
    // ─────────────────────────────────────────────────────────
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'Message' AND column_name = 'readAt'
        ) THEN
          ALTER TABLE "Message" ADD COLUMN "readAt" TIMESTAMPTZ;
        END IF;
      END $$;
    `)
    console.log('5. Message.readAt column: OK')

    // ─────────────────────────────────────────────────────────
    // 6. Atualizar mensagens existentes sem canal para 'whatsapp'
    // ─────────────────────────────────────────────────────────
    const result = await client.query(`
      UPDATE "Message"
      SET "channel" = 'whatsapp'
      WHERE "channel" IS NULL OR "channel" = '';
    `)
    console.log(`6. Backfill existing messages to 'whatsapp': ${result.rowCount} rows updated`)

    // ─────────────────────────────────────────────────────────
    // 7. Garantir coluna `type` no CrmChannel (para filtro de canal)
    // ─────────────────────────────────────────────────────────
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'CrmChannel' AND column_name = 'type'
        ) THEN
          ALTER TABLE "CrmChannel" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'whatsapp';
        END IF;
      END $$;
    `)
    console.log('7. CrmChannel.type column: OK')

    // ─────────────────────────────────────────────────────────
    // 8. Índice em CrmChannel(tenantId, type) para lookup rápido
    // ─────────────────────────────────────────────────────────
    await client.query(`
      CREATE INDEX IF NOT EXISTS "CrmChannel_tenantId_type_idx"
      ON "CrmChannel" ("tenantId", "type");
    `)
    console.log('8. CrmChannel(tenantId, type) index: OK')

    console.log('\n=== Fase 6 migration completa! ===')
    console.log('\nCanais suportados: whatsapp, instagram, facebook, telegram, email')

  } catch (err) {
    console.error('Migration FALHOU:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

run()
