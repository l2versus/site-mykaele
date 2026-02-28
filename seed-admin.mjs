#!/usr/bin/env node
import Database from 'better-sqlite3'
import bcryptjs from 'bcryptjs'

const db = new Database('dev.db')

try {
    // Delete existing admin with wrong email if exists
    db.prepare('DELETE FROM "User" WHERE email = ?').run('mykaele@spa.com')

    // Delete existing admin with old email
    db.prepare('DELETE FROM "User" WHERE email = ?').run('mykaele@homespa.com')

    // Create new admin with correct email
    const adminPass = bcryptjs.hashSync('admin123', 10)

    const stmt = db.prepare(`
    INSERT INTO "User" (id, email, password, name, phone, role, balance, "createdAt", "updatedAt")
    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `)

    stmt.run(
        'admin-001',
        'mykaele@spa.com',
        adminPass,
        'Mykaele Procópio',
        '(85) 99908-6924',
        'ADMIN',
        0
    )

    console.log('✅ Admin criado com sucesso!')
    console.log('📧 Email: mykaele@spa.com')
    console.log('🔑 Senha: admin123')

    // Verify
    const user = db.prepare('SELECT * FROM "User" WHERE email = ?').get('mykaele@spa.com')
    if (user) {
        console.log('\n✓ Usuário verificado no banco de dados')
    }

    process.exit(0)
} catch (error) {
    console.error('❌ Erro:', error.message)
    process.exit(1)
}
