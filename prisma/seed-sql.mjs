// prisma/seed-sql.mjs — Seed via Node.js built-in SQLite
import { DatabaseSync } from 'node:sqlite'
import { randomBytes, createHash } from 'node:crypto'
import { hashSync } from 'bcryptjs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dbPath = resolve(__dirname, '..', 'dev.db')
const db = new DatabaseSync(dbPath)

function cuid() {
    const ts = Date.now().toString(36)
    const rand = randomBytes(8).toString('hex')
    return `c${ts}${rand}`
}

const now = new Date().toISOString()

// Users
const adminId = cuid()
const patientId = cuid()
const adminPass = hashSync('admin123', 10)
const patientPass = hashSync('cliente123', 10)

db.exec(`DELETE FROM User; DELETE FROM Service; DELETE FROM PackageOption; DELETE FROM Schedule;`)

db.prepare(`INSERT INTO User (id, email, password, name, phone, role, balance, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(adminId, 'mykaele@homespa.com', adminPass, 'Mykaele Procópio', '(85) 99908-6924', 'ADMIN', 0, now, now)

db.prepare(`INSERT INTO User (id, email, password, name, phone, role, balance, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(patientId, 'cliente@demo.com', patientPass, 'Mykaele Procópio', '(85) 98888-0000', 'PATIENT', 0, now, now)

// Services
const metodoId = cuid()
const massagemId = cuid()
const mantaId = cuid()

const insertSvc = db.prepare(`INSERT INTO Service (id, name, description, duration, price, priceReturn, active, isAddon, travelFee, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)

insertSvc.run(metodoId, 'Método Mykaele Procópio',
    'Protocolo exclusivo de remodelação corporal de alta performance. Resultados visíveis desde a primeira sessão.',
    60, 330, 330, 1, 0, 'Taxa de deslocamento conforme distância', now, now)

insertSvc.run(massagemId, 'Massagem Relaxante',
    'Massagem terapêutica de relaxamento profundo para alívio de tensões e bem-estar completo.',
    60, 280, 280, 1, 0, 'Taxa de deslocamento conforme distância', now, now)

insertSvc.run(mantaId, 'Manta Térmica (Adicional)',
    'Potencialize seu tratamento com 30 minutos de manta térmica para resultados intensificados.',
    30, 80, 80, 1, 1, null, now, now)

// Package Options
const insertPkg = db.prepare(`INSERT INTO PackageOption (id, serviceId, name, sessions, price, active, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?)`)
insertPkg.run(cuid(), metodoId, 'Pacote 5 sessões', 5, 1500, 1, now, now)
insertPkg.run(cuid(), metodoId, 'Pacote 10 sessões', 10, 2800, 1, now, now)
insertPkg.run(cuid(), massagemId, 'Pacote 5 sessões', 5, 1300, 1, now, now)
insertPkg.run(cuid(), massagemId, 'Pacote 10 sessões', 10, 2500, 1, now, now)

// Schedule (Mon=1 to Sat=6 active, Sun=0 off)
const insertSched = db.prepare(`INSERT INTO Schedule (id, dayOfWeek, startTime, endTime, slotDuration, breakStart, breakEnd, active) VALUES (?,?,?,?,?,?,?,?)`)
insertSched.run(cuid(), 0, '08:00', '18:00', 60, '12:00', '13:00', 0) // Dom OFF
insertSched.run(cuid(), 1, '08:00', '18:00', 60, '12:00', '13:00', 1) // Seg
insertSched.run(cuid(), 2, '08:00', '18:00', 60, '12:00', '13:00', 1) // Ter
insertSched.run(cuid(), 3, '08:00', '18:00', 60, '12:00', '13:00', 1) // Qua
insertSched.run(cuid(), 4, '08:00', '18:00', 60, '12:00', '13:00', 1) // Qui
insertSched.run(cuid(), 5, '08:00', '18:00', 60, '12:00', '13:00', 1) // Sex
insertSched.run(cuid(), 6, '08:00', '14:00', 60, '12:00', '13:00', 1) // Sáb 08-14

console.log('✅ Seed completo!')
console.log(`   Admin: mykaele@homespa.com / admin123`)
console.log(`   Cliente: cliente@demo.com / cliente123`)
console.log(`   Serviços: Método R$330, Relaxante R$280, Manta R$80`)
console.log(`   Pacotes: 4 opções criadas`)
console.log(`   Agenda: Seg-Sex 08-18, Sáb 08-14, Dom OFF`)

db.close()
