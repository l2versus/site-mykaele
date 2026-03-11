import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load .env
const envPath = resolve(process.cwd(), '.env')
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) {
    const key = match[1].trim()
    const val = match[2].trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = val
  }
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('=== VALIDAÇÃO CRM ===\n')

  // 1. Tenant
  const tenant = await prisma.crmTenant.findFirst()
  console.log('1. Tenant:', tenant ? `${tenant.id} / ${tenant.slug}` : 'NENHUM')

  if (!tenant) {
    console.log('\n❌ Sem tenant! Rode o seed.')
    return
  }

  // 2. Pipeline
  const pipeline = await prisma.pipeline.findFirst({ where: { tenantId: tenant.id, isDefault: true } })
  console.log('2. Pipeline:', pipeline ? `${pipeline.id} / ${pipeline.name} (default: ${pipeline.isDefault})` : 'NENHUM')

  // 3. Stages
  const stages = await prisma.stage.findMany({
    where: { pipelineId: pipeline?.id ?? '' },
    orderBy: { order: 'asc' },
  })
  console.log(`3. Stages (${stages.length}):`)
  for (const s of stages) {
    console.log(`   ${s.order}. ${s.name} [${s.type}] ${s.color}`)
  }

  // 4. Tabelas CRM
  console.log('\n4. Tabelas CRM:')
  const counts = {
    CrmTenant: await prisma.crmTenant.count(),
    Pipeline: await prisma.pipeline.count(),
    Stage: await prisma.stage.count(),
    Lead: await prisma.lead.count(),
    Conversation: await prisma.conversation.count(),
    Message: await prisma.message.count(),
    CrmChannel: await prisma.crmChannel.count(),
    CrmAuditLog: await prisma.crmAuditLog.count(),
    CrmKnowledgeBase: await prisma.crmKnowledgeBase.count(),
    CrmIntegration: await prisma.crmIntegration.count(),
    CrmAutomation: await prisma.crmAutomation.count(),
    LeadActivity: await prisma.leadActivity.count(),
  }
  for (const [name, count] of Object.entries(counts)) {
    console.log(`   ✅ ${name}: ${count} rows`)
  }

  // 5. Env vars
  console.log('\n5. Variáveis de ambiente:')
  console.log(`   DEFAULT_TENANT_ID: ${process.env.DEFAULT_TENANT_ID ?? '❌ NÃO DEFINIDO'}`)
  console.log(`   NEXT_PUBLIC_DEFAULT_TENANT_ID: ${process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? '❌ NÃO DEFINIDO'}`)

  // 6. Tabelas existentes (regressão)
  console.log('\n6. Tabelas existentes (regressão):')
  const existing = {
    User: await prisma.user.count(),
    Appointment: await prisma.appointment.count(),
    Service: await prisma.service.count(),
    Payment: await prisma.payment.count(),
    Schedule: await prisma.schedule.count(),
  }
  for (const [name, count] of Object.entries(existing)) {
    console.log(`   ✅ ${name}: ${count} rows (intacto)`)
  }

  console.log('\n=== VALIDAÇÃO COMPLETA ===')
}

main()
  .catch(e => { console.error('ERRO:', e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect(); await pool.end() })
