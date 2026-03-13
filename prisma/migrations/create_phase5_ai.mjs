// prisma/migrations/create_phase5_ai.mjs
// Migration manual — Fase 5: IA Avançada
// - pgvector extension
// - HNSW index em CrmKnowledgeBase.embedding
// - CrmPresence table (presença em tempo real)
// - Coluna aiSummary em Message (já existe via Prisma, garante existência)
// Idempotente — pode rodar múltiplas vezes sem risco.
//
// Uso: node prisma/migrations/create_phase5_ai.mjs

import pg from 'pg'
import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

async function run() {
  const client = await pool.connect()
  try {
    // ─────────────────────────────────────────────────────────
    // 1. pgvector extension
    // ─────────────────────────────────────────────────────────
    await client.query(`CREATE EXTENSION IF NOT EXISTS vector;`)
    console.log('pgvector extension: OK')

    // ─────────────────────────────────────────────────────────
    // 2. Garantir coluna embedding em CrmKnowledgeBase (768 dim)
    // ─────────────────────────────────────────────────────────
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'CrmKnowledgeBase' AND column_name = 'embedding'
        ) THEN
          ALTER TABLE "CrmKnowledgeBase" ADD COLUMN embedding vector(768);
        END IF;
      END $$;
    `)
    console.log('CrmKnowledgeBase.embedding column: OK')

    // ─────────────────────────────────────────────────────────
    // 3. HNSW index para busca semântica rápida
    //    HNSW é mais rápido que IVFFlat conforme chunks crescem
    // ─────────────────────────────────────────────────────────
    // Dropar IVFFlat se existir (versão antiga)
    await client.query(`
      DROP INDEX IF EXISTS "CrmKnowledgeBase_embedding_idx";
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS "CrmKnowledgeBase_embedding_hnsw_idx"
        ON "CrmKnowledgeBase"
        USING hnsw (embedding vector_cosine_ops);
    `)
    console.log('HNSW index em CrmKnowledgeBase.embedding: OK')

    // ─────────────────────────────────────────────────────────
    // 4. CrmPresence — Presença em tempo real da equipe
    //    Redis-first com fallback Postgres
    // ─────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS "CrmPresence" (
        "id"        TEXT NOT NULL DEFAULT gen_random_uuid(),
        "userId"    TEXT NOT NULL,
        "userName"  TEXT NOT NULL,
        "tenantId"  TEXT NOT NULL,
        "status"    TEXT NOT NULL DEFAULT 'offline',
        "lastSeen"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "currentPage" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CrmPresence_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "CrmPresence_userId_tenantId_key" UNIQUE ("userId", "tenantId"),
        CONSTRAINT "CrmPresence_tenantId_fkey"
          FOREIGN KEY ("tenantId") REFERENCES "CrmTenant"("id") ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS "CrmPresence_tenantId_status_idx"
        ON "CrmPresence"("tenantId", "status");
      CREATE INDEX IF NOT EXISTS "CrmPresence_tenantId_lastSeen_idx"
        ON "CrmPresence"("tenantId", "lastSeen" DESC);
    `)
    console.log('CrmPresence table: OK')

    // ─────────────────────────────────────────────────────────
    // 5. Garantir coluna aiSummary em Message
    //    Usada para cachear resumo de conversa (5.4)
    // ─────────────────────────────────────────────────────────
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'Message' AND column_name = 'aiSummary'
        ) THEN
          ALTER TABLE "Message" ADD COLUMN "aiSummary" TEXT;
        END IF;
      END $$;
    `)
    console.log('Message.aiSummary column: OK')

    // ─────────────────────────────────────────────────────────
    // 6. Garantir coluna sentiment em Message
    //    Usada para análise de sentimento por mensagem
    // ─────────────────────────────────────────────────────────
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'Message' AND column_name = 'sentiment'
        ) THEN
          ALTER TABLE "Message" ADD COLUMN sentiment TEXT;
        END IF;
      END $$;
    `)
    console.log('Message.sentiment column: OK')

    // ─────────────────────────────────────────────────────────
    // 7. Índices de performance para queries de IA
    // ─────────────────────────────────────────────────────────
    await client.query(`
      CREATE INDEX IF NOT EXISTS "LeadActivity_leadId_type_createdAt_idx"
        ON "LeadActivity"("leadId", "type", "createdAt" DESC);
    `)
    console.log('LeadActivity composite index: OK')

    // Índice para busca de chunks por tenant + sourceFile
    await client.query(`
      CREATE INDEX IF NOT EXISTS "CrmKnowledgeBase_tenantId_sourceFile_idx"
        ON "CrmKnowledgeBase"("tenantId", "sourceFile");
    `)
    console.log('CrmKnowledgeBase sourceFile index: OK')

    // Índice para busca de mensagens por sentiment
    await client.query(`
      CREATE INDEX IF NOT EXISTS "Message_tenantId_sentiment_idx"
        ON "Message"("tenantId")
        WHERE sentiment IS NOT NULL;
    `)
    console.log('Message sentiment partial index: OK')

    console.log('\n✅ Fase 5 (IA Avançada) — Migration completa!')
    console.log('   - pgvector extension')
    console.log('   - HNSW index (busca semântica rápida)')
    console.log('   - CrmPresence table (presença em tempo real)')
    console.log('   - Message.aiSummary + sentiment columns')
    console.log('   - Performance indexes')
  } catch (err) {
    console.error('❌ Erro na migration:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

run()
