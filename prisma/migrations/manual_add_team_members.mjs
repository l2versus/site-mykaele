import pg from 'pg'
import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

async function run() {
  const client = await pool.connect()
  try {
    await client.query(`
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
        CONSTRAINT "CrmTeamMember_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "CrmTenant"("id") ON DELETE CASCADE
      );

      CREATE UNIQUE INDEX IF NOT EXISTS "CrmTeamMember_tenantId_email_key" ON "CrmTeamMember"("tenantId", "email");
      CREATE INDEX IF NOT EXISTS "CrmTeamMember_tenantId_isActive_idx" ON "CrmTeamMember"("tenantId", "isActive");
      CREATE INDEX IF NOT EXISTS "CrmTeamMember_tenantId_role_idx" ON "CrmTeamMember"("tenantId", "role");

      -- Add assignedToUserId to Lead if not exists
      DO $$ BEGIN
        ALTER TABLE "Lead" ADD COLUMN "assignedToUserId" TEXT;
      EXCEPTION WHEN duplicate_column THEN NULL;
      END $$;
      CREATE INDEX IF NOT EXISTS "Lead_tenantId_assignedToUserId_idx" ON "Lead"("tenantId", "assignedToUserId");
    `)
    console.log('CrmTeamMember table + Lead.assignedToUserId created successfully')
  } finally {
    client.release()
    await pool.end()
  }
}

run().catch(err => { console.error(err); process.exit(1) })
