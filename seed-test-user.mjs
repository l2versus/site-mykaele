import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import bcrypt from 'bcryptjs'

const adapter = new PrismaLibSql({ url: 'file:./dev.db' })
const prisma = new PrismaClient({ adapter })

async function main() {
    // Criar usuário teste
    const hashedPassword = await bcrypt.hash('teste123', 10)

    const user = await prisma.user.upsert({
        where: { email: 'emmanuelbezerra1992@gmail.com' },
        update: {
            name: 'Emmanuel Bezerra',
            phone: '85998500344',
        },
        create: {
            email: 'emmanuelbezerra1992@gmail.com',
            password: hashedPassword,
            name: 'Emmanuel Bezerra',
            phone: '85998500344',
            role: 'PATIENT',
        }
    })

    console.log('✅ Usuário criado:', user.id, user.name)

    // Deletar medidas antigas se existirem
    await prisma.bodyMeasurement.deleteMany({ where: { userId: user.id } })

    // Criar medidas de evolução (3 avaliações mostrando progresso)
    const measurements = [
        {
            date: new Date('2025-12-01'),
            weight: 78.5,
            bodyFat: 28.2,
            abdomen: 95,
            waist: 88,
            hip: 108,
            thighLeft: 62,
            thighRight: 63,
            armLeft: 32,
            armRight: 33,
            bust: 102,
        },
        {
            date: new Date('2026-01-15'),
            weight: 76.2,
            bodyFat: 26.5,
            abdomen: 91,
            waist: 85,
            hip: 105,
            thighLeft: 60,
            thighRight: 61,
            armLeft: 31,
            armRight: 32,
            bust: 100,
        },
        {
            date: new Date('2026-02-28'),
            weight: 74.0,
            bodyFat: 24.8,
            abdomen: 87,
            waist: 82,
            hip: 102,
            thighLeft: 58,
            thighRight: 59,
            armLeft: 30,
            armRight: 31,
            bust: 98,
        }
    ]

    for (const m of measurements) {
        await prisma.bodyMeasurement.create({
            data: {
                ...m,
                userId: user.id,
            }
        })
    }

    console.log('✅ 3 medidas de evolução criadas!')
    console.log('')
    console.log('📋 DADOS DE LOGIN:')
    console.log('   Email: emmanuelbezerra1992@gmail.com')
    console.log('   Senha: teste123')
    console.log('')
    console.log('🎯 Evolução simulada:')
    console.log('   Peso: 78.5kg → 74.0kg (-4.5kg)')
    console.log('   Gordura: 28.2% → 24.8% (-3.4%)')
    console.log('   Abdômen: 95cm → 87cm (-8cm)')

    await prisma.$disconnect()
}

main().catch(console.error)
