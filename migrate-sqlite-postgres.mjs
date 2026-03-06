#!/usr/bin/env node
/**
 * Script para migrar dados do SQLite local para PostgreSQL no Coolify
 */
import Database from 'better-sqlite3'
import pg from 'pg'

const { Pool } = pg

// Conexões
const sqlite = new Database('dev.db')
const postgres = new Pool({
    connectionString: 'postgres://postgres:F2CnUQgJ36UmSz1lvuYHluw99hykrgsnBjehPaUgUkvc2LAhJxL4hLw0s7Ry5C8x@187.77.226.144:5432/postgres'
})

async function migrate() {
    console.log('🚀 Iniciando migração SQLite → PostgreSQL...\n')

    try {
        // 1. Migrar Usuários
        console.log('👥 Migrando usuários...')
        const users = sqlite.prepare('SELECT * FROM User').all()
        let usersAdded = 0

        for (const user of users) {
            try {
                // Verificar se já existe
                const exists = await postgres.query('SELECT id FROM "User" WHERE email = $1', [user.email])
                if (exists.rows.length > 0) {
                    console.log(`   ⏭️  ${user.email} já existe`)
                    continue
                }

                await postgres.query(`
          INSERT INTO "User" (id, email, password, name, phone, "cpfRg", address, "addressCep", "addressStreet", "addressNumber", "addressComp", "addressNeighborhood", "addressCity", "addressState", "addressLat", "addressLng", "googleId", "instagramId", role, avatar, balance, "cashbackBalance", "forcePasswordChange", "emailVerified", "emailVerifiedAt", "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, COALESCE($26, NOW()), NOW())
          ON CONFLICT (email) DO NOTHING
        `, [
                    user.id, user.email, user.password, user.name, user.phone,
                    user.cpfRg, user.address, user.addressCep, user.addressStreet,
                    user.addressNumber, user.addressComp, user.addressNeighborhood,
                    user.addressCity, user.addressState, user.addressLat, user.addressLng,
                    user.googleId, user.instagramId, user.role, user.avatar,
                    user.balance || 0, user.cashbackBalance || 0,
                    user.forcePasswordChange || false, user.emailVerified || false,
                    user.emailVerifiedAt, user.createdAt
                ])
                usersAdded++
                console.log(`   ✅ ${user.name} (${user.email})`)
            } catch (err) {
                console.log(`   ❌ Erro em ${user.email}:`, err.message)
            }
        }
        console.log(`   Total: ${usersAdded} usuários migrados\n`)

        // 2. Migrar Serviços
        console.log('💆 Migrando serviços...')
        const services = sqlite.prepare('SELECT * FROM Service').all()
        let servicesAdded = 0

        for (const svc of services) {
            try {
                const exists = await postgres.query('SELECT id FROM "Service" WHERE name = $1', [svc.name])
                if (exists.rows.length > 0) {
                    console.log(`   ⏭️  ${svc.name} já existe`)
                    continue
                }

                await postgres.query(`
          INSERT INTO "Service" (id, name, description, duration, price, "priceReturn", active, "isAddon", "travelFee", "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, NOW()), NOW())
          ON CONFLICT (name) DO NOTHING
        `, [
                    svc.id, svc.name, svc.description, svc.duration, svc.price,
                    svc.priceReturn, svc.active !== 0, svc.isAddon !== 0, svc.travelFee, svc.createdAt
                ])
                servicesAdded++
                console.log(`   ✅ ${svc.name}`)
            } catch (err) {
                console.log(`   ❌ Erro em ${svc.name}:`, err.message)
            }
        }
        console.log(`   Total: ${servicesAdded} serviços migrados\n`)

        // 3. Verificar contagem final
        console.log('📊 Verificando banco PostgreSQL...')
        const pgUsers = await postgres.query('SELECT COUNT(*) FROM "User"')
        const pgServices = await postgres.query('SELECT COUNT(*) FROM "Service"')

        console.log(`   Usuários: ${pgUsers.rows[0].count}`)
        console.log(`   Serviços: ${pgServices.rows[0].count}`)

        console.log('\n🎉 Migração concluída!')

    } catch (error) {
        console.error('❌ Erro na migração:', error.message)
    } finally {
        sqlite.close()
        await postgres.end()
    }
}

migrate()
