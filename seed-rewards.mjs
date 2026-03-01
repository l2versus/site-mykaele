// seed-rewards.mjs — Seed de recompensas padrão do programa de fidelidade
// Rodar: node seed-rewards.mjs

import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

const dbUrl = process.env.DATABASE_URL || 'file:./dev.db'
const adapter = new PrismaLibSql({ url: dbUrl })
const prisma = new PrismaClient({ adapter })

const defaultRewards = [
    {
        name: 'Desconto de R$30',
        description: 'Válido para qualquer sessão avulsa',
        pointsCost: 300,
        type: 'DISCOUNT',
        value: 30,
        imageEmoji: '💰',
        active: true,
    },
    {
        name: 'Desconto de R$50',
        description: 'Válido para qualquer sessão avulsa',
        pointsCost: 500,
        type: 'DISCOUNT',
        value: 50,
        imageEmoji: '💎',
        active: true,
    },
    {
        name: 'Desconto de R$100',
        description: 'Válido para qualquer serviço ou pacote',
        pointsCost: 900,
        type: 'DISCOUNT',
        value: 100,
        imageEmoji: '🌟',
        active: true,
    },
    {
        name: 'Manta Térmica Grátis',
        description: 'Add-on de Manta Térmica (30min) grátis na próxima sessão',
        pointsCost: 400,
        type: 'FREE_ADDON',
        value: 80,
        imageEmoji: '🔥',
        active: true,
    },
    {
        name: 'Massagem Relaxante Grátis',
        description: 'Uma sessão completa de Massagem Relaxante (90min)',
        pointsCost: 1400,
        type: 'FREE_SESSION',
        value: 280,
        imageEmoji: '💆',
        active: true,
    },
    {
        name: 'Método Mykaele Procópio Grátis',
        description: 'Uma sessão completa do Método exclusivo (90min)',
        pointsCost: 1650,
        type: 'FREE_SESSION',
        value: 330,
        imageEmoji: '👑',
        active: true,
    },
    {
        name: 'Upgrade para Método Premium',
        description: 'Transforme qualquer sessão em Método Mykaele Procópio',
        pointsCost: 600,
        type: 'UPGRADE',
        value: 120,
        imageEmoji: '✨',
        active: true,
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
