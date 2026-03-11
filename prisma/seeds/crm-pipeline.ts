// prisma/seeds/crm-pipeline.ts — 6 estágios padrão da jornada estética
// Executar: set -a && source .env && npx tsx prisma/seeds/crm-pipeline.ts
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

// Carregar .env manualmente (tsx não carrega automaticamente)
const envPath = resolve(import.meta.dirname ?? '.', '../../.env')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      const val = match[2].trim().replace(/^["']|["']$/g, '')
      if (!process.env[key]) process.env[key] = val
    }
  }
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const TENANT_SLUG = 'clinica-mykaele-procopio'

const STAGES = [
  { name: 'Novo Contato',     type: 'OPEN' as const,  order: 1, color: '#4A7BFF' },
  { name: 'Em Atendimento',   type: 'OPEN' as const,  order: 2, color: '#F0A500' },
  { name: 'Proposta Enviada', type: 'OPEN' as const,  order: 3, color: '#FF6B4A' },
  { name: 'Agendamento',      type: 'OPEN' as const,  order: 4, color: '#D4AF37' },
  { name: 'Ganho',            type: 'WON' as const,   order: 5, color: '#2ECC8A' },
  { name: 'Perdido',          type: 'LOST' as const,  order: 6, color: '#8B8A94' },
]

async function seed(): Promise<void> {
  // Criar ou buscar tenant
  let tenant = await prisma.crmTenant.findUnique({
    where: { slug: TENANT_SLUG },
  })

  if (!tenant) {
    tenant = await prisma.crmTenant.create({
      data: {
        name: 'Clínica Mykaele Procópio',
        slug: TENANT_SLUG,
      },
    })
    console.error(`[seed] Tenant criado: ${tenant.id}`)
  } else {
    console.error(`[seed] Tenant existente: ${tenant.id}`)
  }

  // Criar ou buscar pipeline padrão
  let pipeline = await prisma.pipeline.findFirst({
    where: { tenantId: tenant.id, isDefault: true },
  })

  if (!pipeline) {
    pipeline = await prisma.pipeline.create({
      data: {
        tenantId: tenant.id,
        name: 'Jornada Estética',
        isDefault: true,
      },
    })
    console.error(`[seed] Pipeline criado: ${pipeline.id}`)
  } else {
    console.error(`[seed] Pipeline existente: ${pipeline.id}`)
  }

  // Criar estágios
  for (const stage of STAGES) {
    const existing = await prisma.stage.findFirst({
      where: {
        pipelineId: pipeline.id,
        name: stage.name,
      },
    })

    if (!existing) {
      await prisma.stage.create({
        data: {
          pipelineId: pipeline.id,
          tenantId: tenant.id,
          name: stage.name,
          type: stage.type,
          order: stage.order,
          color: stage.color,
        },
      })
      console.error(`[seed] Estágio criado: ${stage.name}`)
    } else {
      console.error(`[seed] Estágio existente: ${stage.name}`)
    }
  }

  console.error('[seed] Pipeline CRM semeado com sucesso!')
  console.error(`[seed] Tenant ID: ${tenant.id}`)
  console.error('[seed] Configure DEFAULT_TENANT_ID no .env com o ID acima')
}

seed()
  .catch((err) => {
    console.error('[seed] Erro:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
