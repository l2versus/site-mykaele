#!/usr/bin/env node
import pg from 'pg'
import bcryptjs from 'bcryptjs'

const { Pool } = pg

// Conexão com PostgreSQL no Coolify
const DATABASE_URL = 'postgres://postgres:F2CnUQgJ36UmSz1lvuYHluw99hykrgsnBjehPaUgUkvc2LAhJxL4hLw0s7Ry5C8x@187.77.226.144:5432/postgres'

const pool = new Pool({ connectionString: DATABASE_URL })

async function seed() {
    try {
        console.log('🔗 Conectando ao PostgreSQL...')

        // 1. Criar usuários admin
        const adminPass = bcryptjs.hashSync('myka2024', 10)

        // Deletar admin existente se houver
        await pool.query('DELETE FROM "User" WHERE email IN ($1, $2)', ['admin@mykaprocopio.com.br', 'mykaele@spa.com'])

        // Criar admin principal
        const adminResult = await pool.query(`
      INSERT INTO "User" (id, email, password, name, phone, role, balance, "cashbackBalance", "forcePasswordChange", "emailVerified", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      ON CONFLICT (email) DO UPDATE SET password = $3, "updatedAt" = NOW()
      RETURNING id
    `, [
            'admin-mykaele-001',
            'admin@mykaprocopio.com.br',
            adminPass,
            'Mykaele Procópio',
            '(85) 99908-6924',
            'ADMIN',
            0,
            0,
            false,
            true
        ])

        console.log('✅ Admin principal criado!')
        console.log('   📧 Email: admin@mykaprocopio.com.br')
        console.log('   🔑 Senha: myka2024')

        // 2. Limpar e popular serviços
        const servicesCount = await pool.query('SELECT COUNT(*) FROM "Service"')
        if (parseInt(servicesCount.rows[0].count) === 0) {
            console.log('\n📋 Criando serviços...')

            const services = [
                { name: 'Limpeza de Pele', description: 'Limpeza profunda com extração', duration: 90, price: 180 },
                { name: 'Drenagem Linfática', description: 'Drenagem corporal completa', duration: 60, price: 150 },
                { name: 'Massagem Modeladora', description: 'Massagem para modelagem corporal', duration: 60, price: 180 },
                { name: 'Peeling Corporal', description: 'Esfoliação e hidratação corporal', duration: 60, price: 160 },
                { name: 'Hidratação Facial', description: 'Tratamento hidratante para o rosto', duration: 45, price: 120 },
                { name: 'Criolipólise', description: 'Congelamento de gordura localizada', duration: 60, price: 350 },
                { name: 'Radiofrequência', description: 'Tratamento para flacidez', duration: 45, price: 200 },
                { name: 'Microagulhamento', description: 'Estímulo de colágeno', duration: 60, price: 280 },
                { name: 'Depilação a Laser', description: 'Depilação definitiva', duration: 30, price: 150 },
                { name: 'Design de Sobrancelhas', description: 'Design e correção de sobrancelhas', duration: 30, price: 80 },
            ]

            for (const service of services) {
                await pool.query(`
          INSERT INTO "Service" (id, name, description, duration, price, active, "isAddon", "createdAt", "updatedAt")
          VALUES (gen_random_uuid(), $1, $2, $3, $4, true, false, NOW(), NOW())
          ON CONFLICT (name) DO NOTHING
        `, [service.name, service.description, service.duration, service.price])
            }

            console.log(`✅ ${services.length} serviços criados!`)
        }

        // 3. Configurar horários de atendimento
        const scheduleCount = await pool.query('SELECT COUNT(*) FROM "Schedule"')
        if (parseInt(scheduleCount.rows[0].count) === 0) {
            console.log('\n📅 Configurando horários...')

            // Segunda a Sábado (1-6)
            for (let day = 1; day <= 6; day++) {
                await pool.query(`
          INSERT INTO "Schedule" (id, "dayOfWeek", "startTime", "endTime", "slotDuration", active)
          VALUES (gen_random_uuid(), $1, $2, $3, $4, true)
          ON CONFLICT ("dayOfWeek") DO NOTHING
        `, [day, '08:00', '18:00', 60])
            }

            console.log('✅ Horários configurados (Seg-Sáb, 08:00-18:00)!')
        }

        // 4. Verificar dados
        console.log('\n📊 Verificando banco de dados...')

        const users = await pool.query('SELECT COUNT(*) FROM "User"')
        const servicesTotal = await pool.query('SELECT COUNT(*) FROM "Service"')
        const schedules = await pool.query('SELECT COUNT(*) FROM "Schedule"')

        console.log(`   Usuários: ${users.rows[0].count}`)
        console.log(`   Serviços: ${servicesTotal.rows[0].count}`)
        console.log(`   Horários: ${schedules.rows[0].count}`)

        console.log('\n🎉 Seed concluído com sucesso!')
        console.log('\n⚠️  Configure as variáveis de ambiente no Coolify:')
        console.log('   DATABASE_URL=' + DATABASE_URL)
        console.log('   ADMIN_PASSWORD=myka2024')
        console.log('   JWT_SECRET=mykaele-home-spa-secret-key-2024')
        console.log('   NEXTAUTH_SECRET=mykaele-nextauth-secret-2024')
        console.log('   NEXT_PUBLIC_APP_URL=https://mykaprocopio.com.br')

        await pool.end()
        process.exit(0)

    } catch (error) {
        console.error('❌ Erro:', error.message)
        console.error(error)
        await pool.end()
        process.exit(1)
    }
}

seed()
