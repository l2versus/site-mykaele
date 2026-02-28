// prisma/seed.mjs — Seed script
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    console.log('🌱 Seeding...')

    // Admin
    const adminPass = bcrypt.hashSync('admin123', 10)
    await prisma.user.create({ data: { email: 'mykaele@homespa.com', password: adminPass, name: 'Mykaele Procópio', phone: '(85) 99908-6924', role: 'ADMIN' } })

    // Demo patient
    const patientPass = bcrypt.hashSync('cliente123', 10)
    await prisma.user.create({ data: { email: 'cliente@demo.com', password: patientPass, name: 'Mykaele Procópio', phone: '(85) 98888-0000', role: 'PATIENT', balance: 0 } })

    // Método Mykaele Procópio
    const metodo = await prisma.service.create({
        data: {
            name: 'Método Mykaele Procópio',
            description: 'Protocolo exclusivo de remodelação corporal de alta performance. Resultados visíveis desde a primeira sessão.',
            duration: 90, price: 330, priceReturn: 330, active: true, isAddon: false,
            travelFee: 'Taxa de deslocamento de acordo com a distância'
        }
    })
    await prisma.packageOption.create({ data: { serviceId: metodo.id, name: 'Pacote 5 sessões', sessions: 5, price: 1500, active: true } })
    await prisma.packageOption.create({ data: { serviceId: metodo.id, name: 'Pacote 10 sessões', sessions: 10, price: 2800, active: true } })

    // Massagem Relaxante
    const massagem = await prisma.service.create({
        data: {
            name: 'Massagem Relaxante',
            description: 'Massagem terapêutica de relaxamento profundo para alívio de tensões e bem-estar.',
            duration: 90, price: 280, priceReturn: 280, active: true, isAddon: false,
            travelFee: 'Taxa de deslocamento de acordo com a distância'
        }
    })
    await prisma.packageOption.create({ data: { serviceId: massagem.id, name: 'Pacote 5 sessões', sessions: 5, price: 1300, active: true } })
    await prisma.packageOption.create({ data: { serviceId: massagem.id, name: 'Pacote 10 sessões', sessions: 10, price: 2500, active: true } })

    // Adicional: Manta Térmica
    await prisma.service.create({
        data: {
            name: 'Manta Térmica (Adicional)',
            description: 'Potencialize seu tratamento com 30 minutos de manta térmica.',
            duration: 30, price: 80, priceReturn: 80, active: true, isAddon: true
        }
    })

    // Schedule
    for (let d = 0; d <= 6; d++) {
        await prisma.schedule.create({
            data: {
                dayOfWeek: d, startTime: '08:00', endTime: d === 6 ? '14:00' : '18:00',
                slotDuration: 90, breakStart: '12:00', breakEnd: '13:00', active: d !== 0
            }
        })
    }

    console.log('✅ SEED OK')
}

main().catch(console.error).finally(() => prisma.$disconnect())
