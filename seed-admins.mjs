// seed-admins.mjs — Atualiza admin e cria dev admin
// Roda no servidor Coolify: node seed-admins.mjs
// Requer DATABASE_URL no ambiente (PostgreSQL)

import pg from 'pg'
import bcryptjs from 'bcryptjs'
const { Client } = pg

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) { console.error('❌ DATABASE_URL não definida'); process.exit(1) }

const client = new Client({ connectionString: DATABASE_URL })

async function main() {
  await client.connect()
  console.log('🔗 Conectado ao banco')

  // 1. Atualizar senha admin existente → @Luna1997_
  const adminHash = await bcryptjs.hash('@Luna1997_', 10)
  const res1 = await client.query(`UPDATE "User" SET password = $1 WHERE email = $2`, [adminHash, 'admin@mykaele.com'])
  console.log(res1.rowCount > 0
    ? '✅ Senha atualizada: admin@mykaele.com → @Luna1997_'
    : '⚠️ admin@mykaele.com não encontrado')

  // 2. Criar/atualizar dev admin → eb@dev.com.br / @Luna1992_
  const devHash = await bcryptjs.hash('@Luna1992_', 10)
  const now = new Date().toISOString()
  const res2 = await client.query(`
    INSERT INTO "User" (id, email, password, name, role, phone, "forcePasswordChange", "createdAt", "updatedAt")
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password, role = EXCLUDED.role, name = EXCLUDED.name, "updatedAt" = EXCLUDED."updatedAt"
    RETURNING id, email, role
  `, ['dev-emmanuel-001', 'eb@dev.com.br', devHash, 'Emmanuel Bezerra', 'ADMIN', '', 0, now, now])
  console.log('✅ Dev admin:', res2.rows[0])

  // Listar admins
  const admins = await client.query(`SELECT email, name, role FROM "User" WHERE role = 'ADMIN'`)
  console.log('\n📋 Admins:')
  admins.rows.forEach(a => console.log(`   • ${a.email} — ${a.name}`))

  await client.end()
  console.log('\n🎉 Pronto!')
}

main().catch(e => { console.error('❌', e); process.exit(1) })
