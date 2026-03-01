// seed-rewards.mjs — Seed de recompensas padrão do programa de fidelidade
// Rodar: node seed-rewards.mjs

import { PrismaClient } from './.prisma/client/index.js'
import { createClient } from '@libsql/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'

const libsql = createClient({ url: process.env.TURSO_DATABASE_URL ?? 'file:./prisma/dev.db' })
const adapter = new PrismaLibSQL(libsql)
const prisma = new PrismaClient({ adapter })

const defaultRewards = [
    {
        name: 'Desconto de R$30',
        description: 'Ganhe R$30 de desconto na próxima sessão',
        pointsCost: 300,
        type: 'DISCOUNT',
        value: 30,
        imageEmoji: '💰',
        active: true,
    },
    {
        name: 'Desconto de R$50',
        description: 'Ganhe R$50 de desconto na próxima sessão',
        pointsCost: 500,
        type: 'DISCOUNT',
        value: 50,
        imageEmoji: '💎',
        active: true,
    },
    {
        name: 'Desconto de R$100',
        description: 'Ganhe R$100 de desconto em qualquer serviço',
        pointsCost: 900,
        type: 'DISCOUNT',
        value: 100,
        imageEmoji: '🌟',
        active: true,
    },
    {
        name: 'Sessão Grátis',
        description: 'Resgate uma sessão gratuita de qualquer serviço até R$200',
        pointsCost: 1500,
        type: 'FREE_SESSION',
        value: 200,
        imageEmoji: '🎁',
        active: true,
    },
    {
        name: 'Add-on Grátis',
        description: 'Ganhe um serviço adicional (add-on) gratuito',
        pointsCost: 400,
        type: 'FREE_ADDON',
        value: 80,
        imageEmoji: '✨',
        active: true,
    },
    {
        name: 'Upgrade Premium',
        description: 'Upgrade de qualquer sessão para versão premium',
        pointsCost: 600,
        type: 'UPGRADE',
        value: 120,
        imageEmoji: '👑',
        active: true,
    },
    {
        name: 'Kit Skincare',
        description: 'Kit de cuidados pós-procedimento da Mykaele',
        pointsCost: 800,
        type: 'GIFT',
        value: 150,
        imageEmoji: '🧴',
        active: true,
        stock: 10,
    },
]

async function main() {
    console.log('🎁 Criando recompensas padrão...\n')

    for (const reward of defaultRewards) {
        const existing = await prisma.loyaltyReward.findFirst({
            where: { name: reward.name },
        })

        if (existing) {
            console.log(`  ⏭️  "${reward.name}" já existe`)
            continue
        }

        await prisma.loyaltyReward.create({ data: reward })
        console.log(`  ✅ "${reward.name}" — ${reward.pointsCost} pts — ${reward.imageEmoji}`)
    }

    console.log('\n✨ Recompensas prontas!')
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
