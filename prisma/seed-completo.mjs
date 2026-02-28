// prisma/seed-completo.mjs — Seed COMPLETO com dados reais: medidas, agendamentos, pagamentos, anamnese
import { DatabaseSync } from 'node:sqlite'
import { randomBytes } from 'node:crypto'
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

// ─── Helper de datas ───
function daysAgo(d) { const dt = new Date(); dt.setDate(dt.getDate() - d); return dt }
function daysFromNow(d) { const dt = new Date(); dt.setDate(dt.getDate() + d); return dt }
function setTime(date, h, m = 0) {
    const d = new Date(date)
    d.setHours(h, m, 0, 0)
    return d
}
function iso(date) { return new Date(date).toISOString() }

const now = new Date().toISOString()

console.log('🧹 Limpando tabelas...')
db.exec(`
  DELETE FROM Anamnese;
  DELETE FROM SessionFeedback;
  DELETE FROM CareGuideline;
  DELETE FROM BodyMeasurement;
  DELETE FROM Payment;
  DELETE FROM Expense;
  DELETE FROM Appointment;
  DELETE FROM Package;
  DELETE FROM PackageOption;
  DELETE FROM Service;
  DELETE FROM BlockedDate;
  DELETE FROM Schedule;
  DELETE FROM User;
`)

// ═══════════════════════════════════════════════
//  USERS
// ═══════════════════════════════════════════════
console.log('👤 Criando usuários...')
const adminId = cuid()
const mariaId = cuid()
const anaId = cuid()
const julianaId = cuid()

const adminPass = hashSync('admin123', 10)
const clientePass = hashSync('cliente123', 10)

const insertUser = db.prepare(`INSERT INTO User (id, email, password, name, phone, cpfRg, address, role, balance, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)

insertUser.run(adminId, 'mykaele@homespa.com', adminPass, 'Mykaele Procópio', '(85) 99908-6924', null, null, 'ADMIN', 0, now, now)
insertUser.run(mariaId, 'cliente@demo.com', clientePass, 'Maria Silva', '(85) 98888-1234', '123.456.789-00', 'Rua das Flores, 42 - Aldeota, Fortaleza/CE', 'PATIENT', 0, now, now)
insertUser.run(anaId, 'ana@demo.com', clientePass, 'Ana Costa', '(85) 97777-5678', '987.654.321-00', 'Av. Beira Mar, 1200 - Meireles, Fortaleza/CE', 'PATIENT', 0, now, now)
insertUser.run(julianaId, 'juliana@demo.com', clientePass, 'Juliana Santos', '(85) 96666-9012', '456.789.123-00', 'Rua Silva Jatahy, 85 - Meireles, Fortaleza/CE', 'PATIENT', 0, now, now)

console.log('  ✅ Admin: mykaele@homespa.com / admin123')
console.log('  ✅ Maria Silva: cliente@demo.com / cliente123')
console.log('  ✅ Ana Costa: ana@demo.com / cliente123')
console.log('  ✅ Juliana Santos: juliana@demo.com / cliente123')

// ═══════════════════════════════════════════════
//  SERVICES
// ═══════════════════════════════════════════════
console.log('\n💆 Criando serviços...')
const metodoId = cuid()
const massagemId = cuid()
const mantaId = cuid()

const insertSvc = db.prepare(`INSERT INTO Service (id, name, description, duration, price, priceReturn, active, isAddon, travelFee, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)

insertSvc.run(metodoId, 'Método Mykaele Procópio',
    'Protocolo exclusivo de remodelação corporal de alta performance. Resultados visíveis desde a primeira sessão.',
    90, 330, 330, 1, 0, 'Taxa de deslocamento conforme distância', now, now)

insertSvc.run(massagemId, 'Massagem Relaxante',
    'Massagem terapêutica de relaxamento profundo para alívio de tensões e bem-estar completo.',
    90, 280, 280, 1, 0, 'Taxa de deslocamento conforme distância', now, now)

insertSvc.run(mantaId, 'Manta Térmica (Adicional)',
    'Potencialize seu tratamento com 30 minutos de manta térmica para resultados intensificados.',
    30, 80, 80, 1, 1, null, now, now)

console.log('  ✅ Método Mykaele Procópio — R$330 (90min)')
console.log('  ✅ Massagem Relaxante — R$280 (90min)')
console.log('  ✅ Manta Térmica — R$80 (30min)')

// ═══════════════════════════════════════════════
//  PACKAGE OPTIONS
// ═══════════════════════════════════════════════
console.log('\n📦 Criando opções de pacote...')
const pkgMetodo5Id = cuid()
const pkgMetodo10Id = cuid()
const pkgMassagem5Id = cuid()
const pkgMassagem10Id = cuid()

const insertPkgOpt = db.prepare(`INSERT INTO PackageOption (id, serviceId, name, sessions, price, active, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?)`)
insertPkgOpt.run(pkgMetodo5Id, metodoId, 'Pacote 5 sessões', 5, 1500, 1, now, now)
insertPkgOpt.run(pkgMetodo10Id, metodoId, 'Pacote 10 sessões', 10, 2800, 1, now, now)
insertPkgOpt.run(pkgMassagem5Id, massagemId, 'Pacote 5 sessões', 5, 1300, 1, now, now)
insertPkgOpt.run(pkgMassagem10Id, massagemId, 'Pacote 10 sessões', 10, 2500, 1, now, now)

// ═══════════════════════════════════════════════
//  PACKAGES (protocolos ativos das clientes)
// ═══════════════════════════════════════════════
console.log('\n🎯 Criando protocolos ativos...')
const mariaPkgId = cuid()
const anaPkgId = cuid()

const insertPkg = db.prepare(`INSERT INTO Package (id, userId, packageOptionId, totalSessions, usedSessions, status, purchaseDate, expirationDate, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?)`)

// Maria: Pacote 10 sessões do Método — já fez 4
insertPkg.run(mariaPkgId, mariaId, pkgMetodo10Id, 10, 4, 'ACTIVE', iso(daysAgo(75)), iso(daysFromNow(105)), now, now)
// Ana: Pacote 5 sessões Massagem — já fez 2
insertPkg.run(anaPkgId, anaId, pkgMassagem5Id, 5, 2, 'ACTIVE', iso(daysAgo(50)), iso(daysFromNow(130)), now, now)

console.log('  ✅ Maria: Método 10 sessões (4/10 usadas)')
console.log('  ✅ Ana: Massagem 5 sessões (2/5 usadas)')

// ═══════════════════════════════════════════════
//  SCHEDULE (Agenda semanal)
// ═══════════════════════════════════════════════
console.log('\n📅 Configurando agenda semanal...')
const insertSched = db.prepare(`INSERT INTO Schedule (id, dayOfWeek, startTime, endTime, slotDuration, breakStart, breakEnd, active) VALUES (?,?,?,?,?,?,?,?)`)
insertSched.run(cuid(), 0, '08:00', '18:00', 90, '12:00', '13:00', 0) // Dom OFF
insertSched.run(cuid(), 1, '08:00', '18:00', 90, '12:00', '13:00', 1)
insertSched.run(cuid(), 2, '08:00', '18:00', 90, '12:00', '13:00', 1)
insertSched.run(cuid(), 3, '08:00', '18:00', 90, '12:00', '13:00', 1)
insertSched.run(cuid(), 4, '08:00', '18:00', 90, '12:00', '13:00', 1)
insertSched.run(cuid(), 5, '08:00', '18:00', 90, '12:00', '13:00', 1)
insertSched.run(cuid(), 6, '08:00', '14:00', 90, '12:00', '13:00', 1)
console.log('  ✅ Seg-Sex 08:00–18:00 | Sáb 08:00–14:00 | Dom OFF | Slots 90min')

// ═══════════════════════════════════════════════
//  APPOINTMENTS (Agendamentos — Maria)
// ═══════════════════════════════════════════════
console.log('\n📋 Criando agendamentos...')
const apt1Id = cuid() // Maria — 75 dias atrás
const apt2Id = cuid() // Maria — 55 dias atrás
const apt3Id = cuid() // Maria — 35 dias atrás
const apt4Id = cuid() // Maria — 15 dias atrás
const apt5Id = cuid() // Maria — próxima semana
const apt6Id = cuid() // Ana — 45 dias atrás
const apt7Id = cuid() // Ana — 20 dias atrás
const apt8Id = cuid() // Ana — próxima semana
const apt9Id = cuid() // Juliana — 10 dias atrás (avulso)

const insertApt = db.prepare(`INSERT INTO Appointment (id, userId, serviceId, scheduledAt, endAt, type, status, location, address, notes, addons, travelFee, price, paidFromBalance, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)

// Maria — 4 sessões do Método (COMPLETED) + 1 próxima (CONFIRMED)
const m1Start = setTime(daysAgo(75), 9, 0)
const m1End = setTime(daysAgo(75), 10, 30)
insertApt.run(apt1Id, mariaId, metodoId, iso(m1Start), iso(m1End), 'FIRST', 'COMPLETED', 'HOME_SPA', null, 'Primeira sessão. Avaliação completa realizada.', null, 0, 330, 0, iso(daysAgo(80)), now)

const m2Start = setTime(daysAgo(55), 14, 0)
const m2End = setTime(daysAgo(55), 15, 30)
insertApt.run(apt2Id, mariaId, metodoId, iso(m2Start), iso(m2End), 'RETURN', 'COMPLETED', 'HOME_SPA', null, 'Ótima evolução. Cliente relatou melhora na disposição.', 'Manta Térmica', 0, 410, 0, iso(daysAgo(60)), now)

const m3Start = setTime(daysAgo(35), 10, 0)
const m3End = setTime(daysAgo(35), 11, 30)
insertApt.run(apt3Id, mariaId, metodoId, iso(m3Start), iso(m3End), 'RETURN', 'COMPLETED', 'HOME_SPA', null, 'Redução visível na região abdominal.', null, 0, 330, 0, iso(daysAgo(40)), now)

const m4Start = setTime(daysAgo(15), 9, 0)
const m4End = setTime(daysAgo(15), 10, 30)
insertApt.run(apt4Id, mariaId, metodoId, iso(m4Start), iso(m4End), 'RETURN', 'COMPLETED', 'HOME_SPA', null, 'Resultados excelentes. Medidas atualizadas.', 'Manta Térmica', 0, 410, 0, iso(daysAgo(20)), now)

// Maria — próxima sessão (daqui 5 dias, quarta)
const m5Start = setTime(daysFromNow(5), 9, 0)
const m5End = setTime(daysFromNow(5), 10, 30)
insertApt.run(apt5Id, mariaId, metodoId, iso(m5Start), iso(m5End), 'RETURN', 'CONFIRMED', 'HOME_SPA', null, '5ª sessão do protocolo.', null, 0, 330, 1, now, now)

// Ana — 2 sessões Massagem (COMPLETED) + 1 próxima (PENDING)
const a1Start = setTime(daysAgo(45), 15, 0)
const a1End = setTime(daysAgo(45), 16, 30)
insertApt.run(apt6Id, anaId, massagemId, iso(a1Start), iso(a1End), 'FIRST', 'COMPLETED', 'HOME_SPA', null, 'Primeira sessão. Muita tensão cervical.', null, 0, 280, 0, iso(daysAgo(50)), now)

const a2Start = setTime(daysAgo(20), 15, 0)
const a2End = setTime(daysAgo(20), 16, 30)
insertApt.run(apt7Id, anaId, massagemId, iso(a2Start), iso(a2End), 'RETURN', 'COMPLETED', 'HOME_SPA', null, 'Alívio significativo da tensão. Cliente muito satisfeita.', null, 0, 280, 0, iso(daysAgo(25)), now)

const a3Start = setTime(daysFromNow(7), 14, 0)
const a3End = setTime(daysFromNow(7), 15, 30)
insertApt.run(apt8Id, anaId, massagemId, iso(a3Start), iso(a3End), 'RETURN', 'PENDING', 'HOME_SPA', null, '3ª sessão do pacote.', null, 0, 280, 1, now, now)

// Juliana — 1 sessão avulsa Método (COMPLETED)
const j1Start = setTime(daysAgo(10), 10, 0)
const j1End = setTime(daysAgo(10), 11, 30)
insertApt.run(apt9Id, julianaId, metodoId, iso(j1Start), iso(j1End), 'FIRST', 'COMPLETED', 'AT_HOME', 'Rua Silva Jatahy, 85 - Meireles', 'Sessão avulsa. Interessada no pacote.', 'Manta Térmica', 30, 440, 0, iso(daysAgo(15)), now)

console.log('  ✅ Maria: 4 COMPLETED + 1 CONFIRMED')
console.log('  ✅ Ana: 2 COMPLETED + 1 PENDING')
console.log('  ✅ Juliana: 1 COMPLETED (avulsa + manta + deslocamento)')

// ═══════════════════════════════════════════════
//  PAYMENTS
// ═══════════════════════════════════════════════
console.log('\n💰 Registrando pagamentos...')
const insertPay = db.prepare(`INSERT INTO Payment (id, userId, amount, method, description, status, category, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?)`)

// Maria — Pagou pacote 10 sessões (R$2.800) + 2x manta (R$160)
insertPay.run(cuid(), mariaId, 2800, 'PIX', 'Pacote 10 sessões — Método Mykaele Procópio', 'APPROVED', 'REVENUE', iso(daysAgo(75)), now)
insertPay.run(cuid(), mariaId, 80, 'PIX', 'Manta Térmica — Sessão 2', 'APPROVED', 'REVENUE', iso(daysAgo(55)), now)
insertPay.run(cuid(), mariaId, 80, 'PIX', 'Manta Térmica — Sessão 4', 'APPROVED', 'REVENUE', iso(daysAgo(15)), now)

// Ana — Pagou pacote 5 sessões (R$1.300)
insertPay.run(cuid(), anaId, 1300, 'CARTAO', 'Pacote 5 sessões — Massagem Relaxante', 'APPROVED', 'REVENUE', iso(daysAgo(50)), now)

// Juliana — Pagou avulsa + manta + deslocamento (R$440)
insertPay.run(cuid(), julianaId, 440, 'PIX', 'Método avulso + Manta + Deslocamento', 'APPROVED', 'REVENUE', iso(daysAgo(10)), now)

console.log('  ✅ Maria: R$2.960 (pacote + 2 mantas)')
console.log('  ✅ Ana: R$1.300')
console.log('  ✅ Juliana: R$440')

// ═══════════════════════════════════════════════
//  EXPENSES (Custos operacionais)
// ═══════════════════════════════════════════════
console.log('\n📊 Registrando despesas...')
const insertExp = db.prepare(`INSERT INTO Expense (id, description, amount, category, date, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?)`)

insertExp.run(cuid(), 'Óleos e cremes de massagem — Fornecedor Bio Natural', 450, 'INSUMOS', iso(daysAgo(60)), now, now)
insertExp.run(cuid(), 'Material descartável (lençóis, luvas, toucas)', 180, 'INSUMOS', iso(daysAgo(45)), now, now)
insertExp.run(cuid(), 'Manutenção preventiva — Manta Térmica Estek', 350, 'EQUIPAMENTOS', iso(daysAgo(30)), now, now)
insertExp.run(cuid(), 'Essências aromáticas — Lavanda e Eucalipto', 95, 'INSUMOS', iso(daysAgo(20)), now, now)
insertExp.run(cuid(), 'Marketing e fotografia profissional', 600, 'MARKETING', iso(daysAgo(15)), now, now)
insertExp.run(cuid(), 'Conta de telefone e internet', 189, 'FIXOS', iso(daysAgo(5)), now, now)

console.log('  ✅ 6 despesas registradas — Total: R$1.864')

// ═══════════════════════════════════════════════
//  BODY MEASUREMENTS — Maria (evolução real de 4 meses)
// ═══════════════════════════════════════════════
console.log('\n📏 Registrando medidas corporais (Maria)...')
const insertMeas = db.prepare(`INSERT INTO BodyMeasurement (id, userId, date, weight, height, bodyFat, muscleMass, bmi, bust, waist, abdomen, hip, armLeft, armRight, thighLeft, thighRight, calfLeft, calfRight, goalWeight, goalWaist, goalHip, goalBodyFat, notes, measuredBy, sessionId, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)

// Medida 1 — Avaliação Inicial (75 dias atrás)
const w1 = 72.0, h1 = 165
insertMeas.run(cuid(), mariaId, iso(daysAgo(75)),
    w1, h1, 32.5, 28.0, +(w1 / ((h1 / 100) ** 2)).toFixed(1),
    96.0, 82.0, 88.0, 104.0,
    30.5, 31.0, 61.0, 61.5, 37.5, 37.0,
    65.0, 72.0, 96.0, 24.0,
    'Avaliação inicial. Pele com boa elasticidade. Retenção hídrica moderada.',
    'Mykaele Procópio', apt1Id, now, now)

// Medida 2 — Após 2ª sessão (55 dias atrás)
const w2 = 70.8, h2 = 165
insertMeas.run(cuid(), mariaId, iso(daysAgo(55)),
    w2, h2, 31.0, 28.5, +(w2 / ((h2 / 100) ** 2)).toFixed(1),
    95.0, 79.5, 85.5, 102.0,
    30.0, 30.5, 59.5, 60.0, 37.0, 36.5,
    65.0, 72.0, 96.0, 24.0,
    'Boa evolução! Redução na retenção hídrica. Cintura -2,5cm.',
    'Mykaele Procópio', apt2Id, now, now)

// Medida 3 — Após 3ª sessão (35 dias atrás)
const w3 = 69.2, h3 = 165
insertMeas.run(cuid(), mariaId, iso(daysAgo(35)),
    w3, h3, 29.5, 29.2, +(w3 / ((h3 / 100) ** 2)).toFixed(1),
    93.5, 77.0, 83.0, 100.0,
    29.5, 29.5, 58.0, 58.5, 36.5, 36.0,
    65.0, 72.0, 96.0, 24.0,
    'Excelente progresso! Abdômen -5cm no total. Cintura -5cm.',
    'Mykaele Procópio', apt3Id, now, now)

// Medida 4 — Após 4ª sessão (15 dias atrás) → mais recente
const w4 = 67.8, h4 = 165
insertMeas.run(cuid(), mariaId, iso(daysAgo(15)),
    w4, h4, 28.0, 29.8, +(w4 / ((h4 / 100) ** 2)).toFixed(1),
    92.0, 75.0, 81.0, 98.5,
    29.0, 29.0, 57.0, 57.5, 36.0, 35.5,
    65.0, 72.0, 96.0, 24.0,
    'Resultados impressionantes! -4,2kg, -7cm cintura, -7cm abdômen. Paciente muito motivada.',
    'Mykaele Procópio', apt4Id, now, now)

console.log('  ✅ 4 medições registradas com evolução real:')
console.log('     Peso: 72.0 → 70.8 → 69.2 → 67.8 kg (-4.2 kg)')
console.log('     Cintura: 82.0 → 79.5 → 77.0 → 75.0 cm (-7.0 cm)')
console.log('     Abdômen: 88.0 → 85.5 → 83.0 → 81.0 cm (-7.0 cm)')
console.log('     Quadril: 104.0 → 102.0 → 100.0 → 98.5 cm (-5.5 cm)')
console.log('     % Gordura: 32.5 → 31.0 → 29.5 → 28.0% (-4.5%)')

// ─── Medidas Ana (2 medições) ───
console.log('\n📏 Registrando medidas corporais (Ana)...')
const wa1 = 58.0, ha1 = 160
insertMeas.run(cuid(), anaId, iso(daysAgo(45)),
    wa1, ha1, 25.0, 30.5, +(wa1 / ((ha1 / 100) ** 2)).toFixed(1),
    87.0, 68.0, 74.0, 94.0,
    26.0, 26.5, 53.0, 53.5, 34.0, 33.5,
    56.0, 65.0, 90.0, 22.0,
    'Avaliação inicial. Tensão muscular cervical e lombar significativa.',
    'Mykaele Procópio', apt6Id, now, now)

const wa2 = 57.5, ha2 = 160
insertMeas.run(cuid(), anaId, iso(daysAgo(20)),
    wa2, ha2, 24.5, 31.0, +(wa2 / ((ha2 / 100) ** 2)).toFixed(1),
    86.5, 67.0, 73.0, 93.0,
    25.5, 26.0, 52.5, 53.0, 33.5, 33.0,
    56.0, 65.0, 90.0, 22.0,
    'Melhora na postura e redução da tensão. Boa evolução.',
    'Mykaele Procópio', apt7Id, now, now)

console.log('  ✅ 2 medições registradas para Ana')

// ─── Medida Juliana (1 medição) ───
console.log('\n📏 Registrando medidas corporais (Juliana)...')
const wj1 = 75.5, hj1 = 170
insertMeas.run(cuid(), julianaId, iso(daysAgo(10)),
    wj1, hj1, 30.0, 27.5, +(wj1 / ((hj1 / 100) ** 2)).toFixed(1),
    98.0, 84.0, 90.0, 106.0,
    31.0, 31.5, 62.0, 62.5, 38.0, 38.0,
    68.0, 74.0, 98.0, 25.0,
    'Avaliação inicial. Interesse em pacote de 10 sessões. Alto potencial de resultado.',
    'Mykaele Procópio', apt9Id, now, now)

console.log('  ✅ 1 medição inicial para Juliana')

// ═══════════════════════════════════════════════
//  ANAMNESE — Maria Silva (ficha completa)
// ═══════════════════════════════════════════════
console.log('\n📋 Criando anamnese (Maria)...')
const insertAnam = db.prepare(`INSERT INTO Anamnese (
  id, userId, birthDate, gender, bloodType, weight, height, occupation,
  allergies, medications, chronicConditions, surgeries, healthNotes,
  hasAllergies, hasDiabetes, hasHypertension, hasHeartCondition,
  hasCirculatory, hasProsthetics, hasThyroid, isPregnant,
  isBreastfeeding, hasSkinSensitivity, hasVaricoseVeins, hasRecentSurgery,
  smokingStatus, alcoholUse, exerciseLevel, sleepQuality,
  waterIntake, dietDescription,
  mainGoals, bodyAreas, previousTreatments, expectations,
  consentGiven, completedAt, createdAt, updatedAt
) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)

insertAnam.run(
    cuid(), mariaId,
    '1990-03-15', 'feminino', 'O+', 72.0, 165, 'Analista de marketing',
    'Nenhuma alergia conhecida', 'Anticoncepcional oral', 'Nenhuma', 'Apendicectomia (2015)', 'Boa saúde geral. Sedentária nos últimos meses.',
    0, 0, 0, 0,  // hasAllergies, hasDiabetes, hasHypertension, hasHeartCondition
    0, 0, 0, 0,  // hasCirculatory, hasProsthetics, hasThyroid, isPregnant
    0, 0, 0, 0,  // isBreastfeeding, hasSkinSensitivity, hasVaricoseVeins, hasRecentSurgery
    'nao_fuma', 'social', 'leve', 'boa',
    '1.5L a 2L por dia', 'Alimentação variada, reduzindo carboidratos. Aumentou consumo de água e chás.',
    'Redução de medidas abdominais, definição da cintura, melhora da autoestima',
    'Abdômen, cintura, flancos, coxas',
    'Drenagem linfática (2023)', 'Espero redução visível nas medidas e melhora no contorno corporal',
    1, iso(daysAgo(75)), now, now
)

// Ana — anamnese
insertAnam.run(
    cuid(), anaId,
    '1988-07-22', 'feminino', 'A+', 58.0, 160, 'Advogada',
    'Nenhuma', 'Nenhum', 'Nenhuma', 'Nenhuma', 'Estresse alto no trabalho. Dores cervicais recorrentes.',
    0, 0, 0, 0,
    0, 0, 0, 0,
    0, 0, 0, 0,
    'nao_fuma', 'raramente', 'moderado', 'regular',
    '2L por dia', 'Alimentação equilibrada com preferência para comida natural.',
    'Alívio das tensões musculares, relaxamento profundo, melhora do sono',
    'Região cervical, ombros, lombar',
    'Fisioterapia (2022)', 'Espero alívio da tensão e relaxamento duradouro',
    1, iso(daysAgo(45)), now, now
)

console.log('  ✅ Anamnese Maria — completa')
console.log('  ✅ Anamnese Ana — completa')

// ═══════════════════════════════════════════════
//  SESSION FEEDBACK (Avaliações de satisfação)
// ═══════════════════════════════════════════════
console.log('\n⭐ Registrando feedbacks...')
const insertFb = db.prepare(`INSERT INTO SessionFeedback (id, userId, appointmentId, score, comment, categories, createdAt) VALUES (?,?,?,?,?,?,?)`)

insertFb.run(cuid(), mariaId, apt1Id, 9, 'Primeira sessão maravilhosa! Me senti muito bem-cuidada.', '["atendimento","conforto","profissionalismo"]', iso(daysAgo(75)))
insertFb.run(cuid(), mariaId, apt2Id, 10, 'Já sinto diferença! A manta térmica potencializou muito.', '["resultado","atendimento","experiência"]', iso(daysAgo(55)))
insertFb.run(cuid(), mariaId, apt3Id, 10, 'Resultados visíveis! Cintura muito mais definida.', '["resultado","profissionalismo","conforto"]', iso(daysAgo(35)))
insertFb.run(cuid(), mariaId, apt4Id, 10, 'Estou encantada com a evolução. Melhor investimento!', '["resultado","atendimento","experiência"]', iso(daysAgo(15)))
insertFb.run(cuid(), anaId, apt6Id, 8, 'Muito relaxante! Consegui dormir muito bem depois.', '["conforto","atendimento"]', iso(daysAgo(45)))
insertFb.run(cuid(), anaId, apt7Id, 9, 'Alívio incrível da tensão cervical. Recomendo demais!', '["resultado","conforto","profissionalismo"]', iso(daysAgo(20)))
insertFb.run(cuid(), julianaId, apt9Id, 9, 'Amei a experiência! Quero fazer o pacote de 10 sessões.', '["atendimento","resultado","experiência"]', iso(daysAgo(10)))

console.log('  ✅ 7 feedbacks registrados (média 9.3/10)')

// ═══════════════════════════════════════════════
//  CARE GUIDELINES (Cuidados pós-sessão)
// ═══════════════════════════════════════════════
console.log('\n💊 Criando orientações pós-sessão...')
const insertCare = db.prepare(`INSERT INTO CareGuideline (id, serviceId, title, description, timing, priority, active) VALUES (?,?,?,?,?,?,?)`)

// Cuidados do Método
insertCare.run(cuid(), metodoId, 'Hidratação Intensiva',
    'Beba no mínimo 2 litros de água nas primeiras 24 horas após a sessão. A hidratação potencializa a eliminação de toxinas e acelera os resultados.',
    'imediato', 2, 1)

insertCare.run(cuid(), metodoId, 'Evitar Sol Direto',
    'Não exponha a região tratada ao sol direto por 48 horas. Se precisar sair, use protetor solar FPS 50+ e roupas de proteção.',
    '48h', 2, 1)

insertCare.run(cuid(), metodoId, 'Alimentação Leve',
    'Prefira alimentos leves e naturais nas 24 horas seguintes: frutas, legumes, proteínas magras. Evite frituras, ultraprocessados e excesso de sódio.',
    '24h', 1, 1)

insertCare.run(cuid(), metodoId, 'Usar Cinta Modeladora',
    'Utilize a cinta modeladora por pelo menos 8 horas após a sessão para potencializar o efeito de remodelação e melhora do contorno corporal.',
    '24h', 1, 1)

insertCare.run(cuid(), metodoId, 'Evitar Exercícios Intensos',
    'Evite treinos pesados ou exercícios de alta intensidade por 48 horas. Caminhadas leves são permitidas e até recomendadas.',
    '48h', 1, 1)

insertCare.run(cuid(), metodoId, 'Autodrenagem em Casa',
    'Realize movimentos suaves de autodrenagem linfática diariamente: movimentos ascendentes partindo dos tornozelos até a virilha, 10 minutos por lado.',
    '7d', 0, 1)

insertCare.run(cuid(), metodoId, 'Chá Detox',
    'Tome chá verde ou de dente-de-leão 2x ao dia durante a semana. Auxilia na eliminação de toxinas e redução de retenção hídrica.',
    '7d', 0, 1)

// Cuidados da Massagem
insertCare.run(cuid(), massagemId, 'Hidratação Após Massagem',
    'Beba bastante água após a sessão para ajudar na eliminação de ácido lático e toxinas liberadas durante a massagem.',
    'imediato', 2, 1)

insertCare.run(cuid(), massagemId, 'Descanso e Relaxamento',
    'Evite atividades estressantes nas horas seguintes. Aproveite o estado de relaxamento para um momento de autocuidado.',
    '24h', 1, 1)

insertCare.run(cuid(), massagemId, 'Banho Morno',
    'Um banho morno com sais de Epsom antes de dormir pode prolongar os efeitos da massagem e melhorar a qualidade do sono.',
    '24h', 0, 1)

insertCare.run(cuid(), massagemId, 'Alongamento Suave',
    'Realize alongamentos suaves nos dias seguintes à sessão para manter a musculatura relaxada e prevenir retorno da tensão.',
    '7d', 0, 1)

console.log('  ✅ 11 orientações de cuidados criadas (7 Método + 4 Massagem)')

// ═══════════════════════════════════════════════
//  RESUMO FINAL
// ═══════════════════════════════════════════════
console.log('\n')
console.log('═══════════════════════════════════════════════════')
console.log('  🎉  SEED COMPLETO — MYKAELE HOME SPA')
console.log('═══════════════════════════════════════════════════')
console.log('')
console.log('  👤 USUÁRIOS:')
console.log('     Admin: mykaele@homespa.com / admin123')
console.log('     Maria Silva: cliente@demo.com / cliente123')
console.log('     Ana Costa: ana@demo.com / cliente123')
console.log('     Juliana Santos: juliana@demo.com / cliente123')
console.log('')
console.log('  💆 SERVIÇOS: 3 (Método R$330, Massagem R$280, Manta R$80)')
console.log('  📦 PACOTES: 4 opções | 2 protocolos ativos')
console.log('  📋 AGENDAMENTOS: 9 total (7 COMPLETED, 1 CONFIRMED, 1 PENDING)')
console.log('  💰 PAGAMENTOS: R$4.700 receita total')
console.log('  📊 DESPESAS: R$1.864 total')
console.log('  📏 MEDIDAS: 7 registros (4 Maria, 2 Ana, 1 Juliana)')
console.log('  📋 ANAMNESE: 2 fichas completas (Maria, Ana)')
console.log('  ⭐ FEEDBACKS: 7 avaliações (média 9.3/10)')
console.log('  💊 CUIDADOS: 11 orientações pós-sessão')
console.log('═══════════════════════════════════════════════════')

db.close()
