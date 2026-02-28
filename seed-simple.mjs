#!/usr/bin/env node
import Database from 'better-sqlite3'
import bcryptjs from 'bcryptjs'

const db = new Database('dev.db')

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS "User" (
    id TEXT NOT NULL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    "cpfRg" TEXT,
    address TEXT,
    role TEXT NOT NULL DEFAULT 'PATIENT',
    avatar TEXT,
    balance REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`)

try {
    const adminPass = bcryptjs.hashSync('admin123', 10)

    const stmt = db.prepare(`
    INSERT INTO "User" (id, email, password, name, phone, role, balance, "createdAt", "updatedAt")
    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `)

    stmt.run(
        'admin-001',
        'mykaele@homespa.com',
        adminPass,
        'Mykaele Procópio',
        '(85) 99908-6924',
        'ADMIN',
        0
    )

    const patientPass = bcryptjs.hashSync('cliente123', 10)
    stmt.run(
        'patient-001',
        'cliente@demo.com',
        patientPass,
        'Cliente Demo',
        '(85) 98888-0000',
        'PATIENT',
        0
    )

    console.log('✅ Admin criado: mykaele@homespa.com / admin123')
    console.log('✅ Seed concluído com sucesso!')
} catch (error) {
    console.error('❌ Erro:', error.message)
} finally {
    db.close()
}
