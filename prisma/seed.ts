// prisma/seed.ts — Seed com serviços e pacotes corretos Mykaele Procópio Home Spa
import { PrismaClient } from '@prisma/client'
import { createPrismaClient } from '../prisma.config'
import bcrypt from 'bcryptjs'

const prisma = createPrismaClient() as unknown as PrismaClient

async function main() {
  console.log('🌱 Seeding database...')

  // ══════ Admin User ══════
  const adminPass = await bcrypt.hash('admin123', 10)
  const admin = await prisma.user.upsert({
    where: { email: 'mykaele@homespa.com' },
    update: {},
    create: {
      email: 'mykaele@homespa.com',
      password: adminPass,
      name: 'Mykaele Procópio',
      phone: '(85) 99999-0000',
      role: 'ADMIN',
    },
  })
  console.log('✅ Admin:', admin.email)

  // ══════ Demo Patient ══════
  const patientPass = await bcrypt.hash('cliente123', 10)
  const patient = await prisma.user.upsert({
    where: { email: 'cliente@demo.com' },
    update: {},
    create: {
      email: 'cliente@demo.com',
      password: patientPass,
      name: 'Maria Silva',
      phone: '(85) 98888-0000',
      role: 'PATIENT',
      balance: 0,
    },
  })
  console.log('✅ Paciente demo:', patient.email)

  // ══════ Serviço 1: Método Mykaele Procópio ══════
  const metodo = await prisma.service.create({
    data: {
      name: 'Método Mykaele Procópio',
      description: 'Protocolo exclusivo de remodelação corporal de alta performance. Resultados visíveis desde a primeira sessão.',
      duration: 60,
      price: 330,
      priceReturn: 330,
      active: true,
      isAddon: false,
      travelFee: 'Taxa de deslocamento de acordo com a distância',
    },
  })
  console.log('✅ Serviço:', metodo.name, '- R$', metodo.price)

  // Pacotes Método
  await prisma.packageOption.createMany({
    data: [
      {
        serviceId: metodo.id,
        name: 'Pacote 5 sessões',
        sessions: 5,
        price: 1500,
        active: true,
      },
      {
        serviceId: metodo.id,
        name: 'Pacote 10 sessões',
        sessions: 10,
        price: 2800,
        active: true,
      },
    ],
  })
  console.log('  📦 Pacotes Método: 5 sessões R$1.500 | 10 sessões R$2.800')

  // ══════ Serviço 2: Massagem Relaxante ══════
  const massagem = await prisma.service.create({
    data: {
      name: 'Massagem Relaxante',
      description: 'Massagem terapêutica de relaxamento profundo para alívio de tensões e bem-estar.',
      duration: 60,
      price: 280,
      priceReturn: 280,
      active: true,
      isAddon: false,
      travelFee: 'Taxa de deslocamento de acordo com a distância',
    },
  })
  console.log('✅ Serviço:', massagem.name, '- R$', massagem.price)

  // Pacotes Massagem
  await prisma.packageOption.createMany({
    data: [
      {
        serviceId: massagem.id,
        name: 'Pacote 5 sessões',
        sessions: 5,
        price: 1300,
        active: true,
      },
      {
        serviceId: massagem.id,
        name: 'Pacote 10 sessões',
        sessions: 10,
        price: 2500,
        active: true,
      },
    ],
  })
  console.log('  📦 Pacotes Massagem: 5 sessões R$1.300 | 10 sessões R$2.500')

  // ══════ Adicional: Manta Térmica ══════
  const manta = await prisma.service.create({
    data: {
      name: 'Manta Térmica (Adicional)',
      description: 'Potencialize seu tratamento com 30 minutos de manta térmica. Disponível como adicional no Método e na Massagem Relaxante.',
      duration: 30,
      price: 80,
      priceReturn: 80,
      active: true,
      isAddon: true,
      travelFee: null,
    },
  })
  console.log('✅ Adicional:', manta.name, '- R$', manta.price)

  // ══════ Agenda Semanal ══════
  const days = [
    { dayOfWeek: 0, startTime: '08:00', endTime: '18:00', active: false },
    { dayOfWeek: 1, startTime: '08:00', endTime: '18:00', active: true },
    { dayOfWeek: 2, startTime: '08:00', endTime: '18:00', active: true },
    { dayOfWeek: 3, startTime: '08:00', endTime: '18:00', active: true },
    { dayOfWeek: 4, startTime: '08:00', endTime: '18:00', active: true },
    { dayOfWeek: 5, startTime: '08:00', endTime: '18:00', active: true },
    { dayOfWeek: 6, startTime: '08:00', endTime: '14:00', active: true },
  ]
  for (const day of days) {
    await prisma.schedule.create({
      data: { ...day, slotDuration: 60, breakStart: '12:00', breakEnd: '13:00' },
    })
  }
  console.log('✅ Agenda semanal configurada')

  console.log('\n🎉 Seed completo!')
  console.log('══════════════════════════════════')
  console.log('Serviços:')
  console.log('  • Método Mykaele Procópio: R$330 (avulso) + taxa deslocamento')
  console.log('    - Pacote 5 sessões: R$1.500 (R$300/sessão)')
  console.log('    - Pacote 10 sessões: R$2.800 (R$280/sessão)')
  console.log('  • Massagem Relaxante: R$280 (avulsa) + taxa deslocamento')
  console.log('    - Pacote 5 sessões: R$1.300 (R$260/sessão)')
  console.log('    - Pacote 10 sessões: R$2.500 (R$250/sessão)')
  console.log('  • Manta Térmica (Adicional): R$80 (30min)')
  console.log('══════════════════════════════════')
  console.log('Admin: mykaele@homespa.com / admin123')
  console.log('Demo:  cliente@demo.com / cliente123')
}

main()
  .catch(console.error)
  .finally(async () => { await (prisma as any).$disconnect?.() })
