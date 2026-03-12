// prisma/seeds/crm-templates.ts — 5 templates padrão
// Executar: set -a && source .env && npx tsx prisma/seeds/crm-templates.ts
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

// Carregar .env manualmente
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

const TEMPLATES = [
  {
    type: 'whatsapp',
    name: 'Boas-vindas',
    category: 'boas-vindas',
    content: `Olá {{nome}}, tudo bem? 😊

Seja muito bem-vinda à Clínica Mykaele Procópio! Ficamos felizes com seu interesse.

Estou à disposição para tirar qualquer dúvida sobre nossos procedimentos e agendar uma avaliação sem compromisso.

Como posso te ajudar?`,
    variables: ['{{nome}}'],
  },
  {
    type: 'whatsapp',
    name: 'Confirmação de agendamento',
    category: 'confirmacao',
    content: `Olá {{nome}}! 💛

Seu agendamento está confirmado! Estamos ansiosas para te receber.

Lembre-se:
• Chegar 10 minutos antes do horário
• Evitar maquiagem na região a ser tratada
• Trazer documento com foto

Qualquer dúvida, estou por aqui!`,
    variables: ['{{nome}}'],
  },
  {
    type: 'whatsapp',
    name: 'Lembrete de retorno',
    category: 'lembrete',
    content: `Oi {{nome}}, tudo bem? 🌟

Faz um tempinho que não nos vemos! Queria saber como você está e como estão os resultados do seu último procedimento.

Que tal agendar seu retorno? Temos horários disponíveis esta semana.

Posso verificar para você?`,
    variables: ['{{nome}}'],
  },
  {
    type: 'whatsapp',
    name: 'Follow-up pós consulta',
    category: 'follow-up',
    content: `Oi {{nome}}, tudo bem? 💕

Gostaria de saber como você está se sentindo após o procedimento! É normal ter um leve inchaço nas primeiras 48h.

Alguma dúvida sobre os cuidados pós? Estou aqui para ajudar!`,
    variables: ['{{nome}}'],
  },
  {
    type: 'email',
    name: 'Pós-atendimento',
    category: 'pos-atendimento',
    subject: 'Obrigada pela sua visita, {{nome}}! 💛',
    content: `Olá {{nome}},

Foi um prazer te atender hoje na Clínica Mykaele Procópio!

Lembre-se dos cuidados pós-procedimento que conversamos. Se tiver qualquer dúvida, não hesite em entrar em contato pelo WhatsApp {{telefone}} ou respondendo este e-mail.

Estamos à disposição!

Com carinho,
Equipe Mykaele Procópio`,
    variables: ['{{nome}}', '{{telefone}}'],
  },
]

async function seed() {
  const tenant = await prisma.crmTenant.findUnique({ where: { slug: TENANT_SLUG } })
  if (!tenant) {
    console.error(`Tenant "${TENANT_SLUG}" não encontrado. Execute o seed do pipeline primeiro.`)
    process.exit(1)
  }

  // Verificar se já existem templates
  const existing = await prisma.crmTemplate.count({ where: { tenantId: tenant.id } })
  if (existing > 0) {
    console.log(`Já existem ${existing} templates. Pulando seed.`)
    await pool.end()
    return
  }

  for (const tpl of TEMPLATES) {
    await prisma.crmTemplate.create({
      data: {
        tenantId: tenant.id,
        type: tpl.type,
        name: tpl.name,
        category: tpl.category,
        subject: 'subject' in tpl ? tpl.subject : null,
        content: tpl.content,
        variables: tpl.variables,
      },
    })
    console.log(`  ✓ Template "${tpl.name}" criado`)
  }

  console.log(`\n✅ ${TEMPLATES.length} templates criados com sucesso!`)
  await pool.end()
}

seed().catch((err) => {
  console.error('Erro no seed:', err)
  process.exit(1)
})
