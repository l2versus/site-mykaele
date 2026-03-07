#!/usr/bin/env node
/**
 * Script para criar/atualizar admin no PostgreSQL
 * 
 * Uso:
 *   node scripts/create-admin.mjs
 * 
 * Lê DATABASE_URL do .env ou variável de ambiente.
 * Cria o admin admin@myka.com.br com senha hasheada (bcrypt).
 * Se o email já existir, atualiza a senha e garante role=ADMIN.
 */

import pg from 'pg'
import bcryptjs from 'bcryptjs'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Carrega .env manualmente (sem dependência de dotenv)
function loadEnv() {
    const envPaths = [
        resolve(__dirname, '..', '.env.local'),
        resolve(__dirname, '..', '.env'),
    ]
    for (const p of envPaths) {
        try {
            const content = readFileSync(p, 'utf-8')
            for (const line of content.split('\n')) {
                const trimmed = line.trim()
                if (!trimmed || trimmed.startsWith('#')) continue
                const eqIdx = trimmed.indexOf('=')
                if (eqIdx < 0) continue
                const key = trimmed.slice(0, eqIdx).trim()
                let val = trimmed.slice(eqIdx + 1).trim()
                // Remove aspas envolventes
                if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                    val = val.slice(1, -1)
                }
                if (!process.env[key]) process.env[key] = val
            }
        } catch { /* arquivo não existe, ok */ }
    }
}

loadEnv()

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL não definida. Configure no .env ou .env.local')
    process.exit(1)
}

// ═══ Dados do novo admin ═══
const ADMIN_EMAIL = 'admin@myka.com.br'
const ADMIN_PASSWORD = '@Luna1997_'
const ADMIN_NAME = 'Administrador'
const ADMIN_ROLE = 'ADMIN'

async function main() {
    const pool = new pg.Pool({ connectionString: DATABASE_URL })

    try {
        console.log('🔄 Conectando ao banco de dados...')

        const hashedPassword = await bcryptjs.hash(ADMIN_PASSWORD, 10)
        const now = new Date().toISOString()

        // Verificar se já existe
        const existing = await pool.query(
            'SELECT id, email, role FROM "User" WHERE email = $1',
            [ADMIN_EMAIL]
        )

        if (existing.rows.length > 0) {
            // Atualizar senha e garantir role ADMIN
            await pool.query(
                `UPDATE "User" SET password = $1, role = $2, "updatedAt" = $3 WHERE email = $4`,
                [hashedPassword, ADMIN_ROLE, now, ADMIN_EMAIL]
            )
            console.log('✅ Admin atualizado (senha re-hasheada)')
            console.log(`   📧 Email: ${ADMIN_EMAIL}`)
            console.log(`   🔑 Senha: (conforme definida no script)`)
            console.log(`   👤 Role:  ${ADMIN_ROLE}`)
        } else {
            // Criar novo admin
            const id = `admin-${Date.now()}`
            await pool.query(
                `INSERT INTO "User" (id, email, password, name, role, balance, "forcePasswordChange", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [id, ADMIN_EMAIL, hashedPassword, ADMIN_NAME, ADMIN_ROLE, 0, false, now, now]
            )
            console.log('✅ Novo admin criado com sucesso!')
            console.log(`   📧 Email: ${ADMIN_EMAIL}`)
            console.log(`   🔑 Senha: (conforme definida no script)`)
            console.log(`   👤 Role:  ${ADMIN_ROLE}`)
            console.log(`   🆔 ID:    ${id}`)
        }

        // Listar todos os admins
        const admins = await pool.query(
            `SELECT email, name, role FROM "User" WHERE role = 'ADMIN' ORDER BY "createdAt"`
        )
        console.log('\n📋 Admins no sistema:')
        for (const a of admins.rows) {
            console.log(`   • ${a.email} — ${a.name} (${a.role})`)
        }

        console.log('\n✨ Script finalizado com sucesso!')
    } catch (error) {
        console.error('❌ Erro:', error.message)
        process.exit(1)
    } finally {
        await pool.end()
    }
}

main()
