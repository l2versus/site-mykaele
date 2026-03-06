// app/api/admin/loyalty/route.ts — Admin: Gestão do Programa de Fidelidade
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

function getAdmin(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const user = verifyToken(auth.substring(7))
  return user?.role === 'ADMIN' ? user : null
}

// ═══ GET — Dashboard de fidelidade (membros, ranking, stats) ═══
export async function GET(req: NextRequest) {
  const admin = getAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const section = searchParams.get('section') || 'overview'

    // ─── OVERVIEW ───
    if (section === 'overview') {
      const [totalMembers, totalReferrals, rewards] = await Promise.all([
        prisma.loyaltyPoints.count(),
        prisma.referral.count(),
        prisma.loyaltyReward.findMany({ orderBy: { pointsCost: 'asc' } }),
      ])

      const tierCounts = {
        BRONZE: await prisma.loyaltyPoints.count({ where: { tier: 'BRONZE' } }),
        SILVER: await prisma.loyaltyPoints.count({ where: { tier: 'SILVER' } }),
        GOLD: await prisma.loyaltyPoints.count({ where: { tier: 'GOLD' } }),
        DIAMOND: await prisma.loyaltyPoints.count({ where: { tier: 'DIAMOND' } }),
      }

      const totalPointsIssued = await prisma.loyaltyTransaction.aggregate({
        _sum: { points: true },
        where: { points: { gt: 0 } },
      })

      const totalRedemptions = await prisma.loyaltyTransaction.count({
        where: { type: 'REDEMPTION' },
      })

      return NextResponse.json({
        stats: {
          totalMembers,
          totalReferrals,
          tierCounts,
          totalPointsIssued: totalPointsIssued._sum.points || 0,
          totalRedemptions,
        },
        rewards,
      })
    }

    // ─── MEMBERS ───
    if (section === 'members') {
      const page = parseInt(searchParams.get('page') || '1')
      const limit = 20
      const search = searchParams.get('search') || ''

      const allLoyalty = await prisma.loyaltyPoints.findMany({
        orderBy: { totalEarned: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      })

      const userIds = allLoyalty.map(l => l.userId)
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true, phone: true, avatar: true },
      })
      const userMap = Object.fromEntries(users.map(u => [u.id, u]))

      const members = allLoyalty.map((l, i) => ({
        ...l,
        user: userMap[l.userId] || null,
        position: (page - 1) * limit + i + 1,
      }))

      const total = await prisma.loyaltyPoints.count()
      return NextResponse.json({ members, total, page, totalPages: Math.ceil(total / limit) })
    }

    // ─── REFERRALS ───
    if (section === 'referrals') {
      const referrals = await prisma.referral.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
      })

      const allUserIds = [...new Set(referrals.flatMap(r => [r.referrerId, r.referredUserId]))]
      const users = await prisma.user.findMany({
        where: { id: { in: allUserIds } },
        select: { id: true, name: true, email: true },
      })
      const userMap = Object.fromEntries(users.map(u => [u.id, u]))

      const list = referrals.map(r => ({
        id: r.id,
        referrer: userMap[r.referrerId] || null,
        referred: userMap[r.referredUserId] || null,
        status: r.status,
        createdAt: r.createdAt,
        rewardedAt: r.rewardedAt,
      }))

      return NextResponse.json({ referrals: list })
    }

    // ─── REFERRAL STATS (Dashboard completo de indicações) ───
    if (section === 'referral_stats') {
      const DISCOUNT_TIERS = [
        { min: 1, max: 2, discount: 3, label: 'Iniciante' },
        { min: 3, max: 5, discount: 5, label: 'Engajado' },
        { min: 6, max: 9, discount: 8, label: 'Influenciador' },
        { min: 10, max: 19, discount: 12, label: 'Embaixador' },
        { min: 20, max: 999, discount: 15, label: 'VIP Máximo' },
      ]
      const MAX_DISCOUNT_PERCENT = 15

      // all referral codes
      const allCodes = await prisma.referralCode.findMany({
        orderBy: { usageCount: 'desc' },
      })

      // all referrals
      const allReferrals = await prisma.referral.findMany({
        orderBy: { createdAt: 'desc' },
      })

      // users
      const allCodeOwnerIds = allCodes.map(c => c.userId)
      const allRefUserIds = [...new Set(allReferrals.flatMap(r => [r.referrerId, r.referredUserId]))]
      const uniqueUserIds = [...new Set([...allCodeOwnerIds, ...allRefUserIds])]
      const users = await prisma.user.findMany({
        where: { id: { in: uniqueUserIds } },
        select: { id: true, name: true, email: true, phone: true },
      })
      const userMap = Object.fromEntries(users.map(u => [u.id, u]))

      // ranking by confirmed referrals (CONFIRMED + REWARDED)
      const confirmedByUser: Record<string, number> = {}
      for (const ref of allReferrals) {
        if (ref.status === 'CONFIRMED' || ref.status === 'REWARDED') {
          confirmedByUser[ref.referrerId] = (confirmedByUser[ref.referrerId] || 0) + 1
        }
      }

      const ranking = Object.entries(confirmedByUser)
        .sort(([, a], [, b]) => b - a)
        .map(([userId, count], i) => {
          const confirmed = count
          const tier = DISCOUNT_TIERS.find(t => confirmed >= t.min && confirmed <= t.max)
          const discount = tier ? tier.discount : confirmed >= 20 ? MAX_DISCOUNT_PERCENT : 0
          return {
            position: i + 1,
            userId,
            user: userMap[userId] || null,
            confirmedReferrals: confirmed,
            discount,
            tierLabel: tier?.label || 'Sem tier',
            code: allCodes.find(c => c.userId === userId)?.code || '-',
          }
        })

      // referral details
      const referralList = allReferrals.map(r => ({
        id: r.id,
        referrer: userMap[r.referrerId] || null,
        referred: userMap[r.referredUserId] || null,
        status: r.status,
        createdAt: r.createdAt,
        rewardedAt: r.rewardedAt,
      }))

      // stats
      const totalCodes = allCodes.length
      const totalReferrals = allReferrals.length
      const confirmedReferrals = allReferrals.filter(r => r.status === 'CONFIRMED' || r.status === 'REWARDED').length
      const pendingReferrals = allReferrals.filter(r => r.status === 'PENDING').length
      const usersWithDiscount = ranking.filter(r => r.discount > 0).length
      const avgDiscount = usersWithDiscount > 0 ? (ranking.reduce((s, r) => s + r.discount, 0) / ranking.length).toFixed(1) : '0'
      const maxDiscountGiven = ranking.length > 0 ? Math.max(...ranking.map(r => r.discount)) : 0

      // code details
      const codeDetails = allCodes.map(c => ({
        code: c.code,
        userId: c.userId,
        user: userMap[c.userId] || null,
        usageCount: c.usageCount,
        createdAt: c.createdAt,
      }))

      return NextResponse.json({
        stats: {
          totalCodes,
          totalReferrals,
          confirmedReferrals,
          pendingReferrals,
          usersWithDiscount,
          avgDiscount: parseFloat(avgDiscount),
          maxDiscountGiven,
          maxDiscountAllowed: MAX_DISCOUNT_PERCENT,
        },
        ranking,
        referrals: referralList,
        codes: codeDetails,
        discountTiers: DISCOUNT_TIERS,
      })
    }

    return NextResponse.json({ error: 'Seção inválida' }, { status: 400 })
  } catch (error) {
    console.error('Admin Loyalty GET error:', error)
    return NextResponse.json({ error: 'Erro ao buscar dados' }, { status: 500 })
  }
}

// ═══ POST — Criar recompensa ou ajustar pontos ═══
export async function POST(req: NextRequest) {
  const admin = getAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const body = await req.json()
    const { action } = body

    // ─── SEED DEFAULT REWARDS ───
    if (action === 'seed_rewards') {
      const defaultRewards = [
        { name: 'Desconto de R$30', description: 'Válido para qualquer sessão avulsa', pointsCost: 300, type: 'DISCOUNT', value: 30, imageEmoji: '💰' },
        { name: 'Desconto de R$50', description: 'Válido para qualquer sessão avulsa', pointsCost: 500, type: 'DISCOUNT', value: 50, imageEmoji: '💎' },
        { name: 'Desconto de R$100', description: 'Válido para qualquer serviço ou pacote', pointsCost: 900, type: 'DISCOUNT', value: 100, imageEmoji: '🌟' },
        { name: 'Manta Térmica Grátis', description: 'Add-on de Manta Térmica (30min) grátis na próxima sessão', pointsCost: 400, type: 'FREE_ADDON', value: 80, imageEmoji: '🔥' },
        { name: 'Massagem Relaxante Grátis', description: 'Uma sessão completa de Massagem Relaxante (90min)', pointsCost: 1400, type: 'FREE_SESSION', value: 280, imageEmoji: '💆' },
        { name: 'Método Mykaele Procópio Grátis', description: 'Uma sessão completa do Método exclusivo (90min)', pointsCost: 1650, type: 'FREE_SESSION', value: 330, imageEmoji: '👑' },
        { name: 'Upgrade para Método Premium', description: 'Transforme qualquer sessão em Método Mykaele Procópio', pointsCost: 600, type: 'UPGRADE', value: 120, imageEmoji: '✨' },
      ]

      const created: string[] = []
      const skipped: string[] = []

      for (const reward of defaultRewards) {
        const existing = await prisma.loyaltyReward.findFirst({ where: { name: reward.name } })
        if (existing) {
          skipped.push(reward.name)
          continue
        }
        await prisma.loyaltyReward.create({ data: { ...reward, active: true } })
        created.push(reward.name)
      }

      return NextResponse.json({ message: 'Seed concluído', created, skipped })
    }

    // ─── CREATE REWARD ───
    if (action === 'create_reward') {
      const { name, description, pointsCost, type, value, stock, imageEmoji } = body
      if (!name || !pointsCost || !type || value === undefined) {
        return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 })
      }

      const reward = await prisma.loyaltyReward.create({
        data: {
          name,
          description: description || '',
          pointsCost: parseInt(pointsCost),
          type,
          value: parseFloat(value),
          stock: stock ? parseInt(stock) : null,
          imageEmoji: imageEmoji || '🎁',
          active: true,
        },
      })
      return NextResponse.json({ reward }, { status: 201 })
    }

    // ─── ADJUST POINTS (com reason para auditoria) ───
    if (action === 'adjust_points') {
      const { userId, points, description, reason } = body
      if (!userId || !points) {
        return NextResponse.json({ error: 'userId e points obrigatórios' }, { status: 400 })
      }

      const pointsNum = parseInt(points)

      // Reason é OBRIGATÓRIO para ajustes manuais (auditoria)
      if (!reason && !description) {
        return NextResponse.json({ error: 'Motivo (reason) obrigatório para ajustes manuais' }, { status: 400 })
      }

      let loyalty = await prisma.loyaltyPoints.findUnique({ where: { userId } })
      if (!loyalty) {
        loyalty = await prisma.loyaltyPoints.create({
          data: { userId, points: 0, totalEarned: 0, totalSpent: 0, tier: 'BRONZE' },
        })
      }

      // Impedir saldo negativo
      if (pointsNum < 0 && loyalty.points + pointsNum < 0) {
        return NextResponse.json({ error: `Saldo insuficiente. Atual: ${loyalty.points} pontos` }, { status: 400 })
      }

      function calcTier(total: number) {
        if (total >= 5000) return 'DIAMOND'
        if (total >= 1500) return 'GOLD'
        if (total >= 500) return 'SILVER'
        return 'BRONZE'
      }

      const newTotal = pointsNum > 0 ? loyalty.totalEarned + pointsNum : loyalty.totalEarned
      const newTier = calcTier(newTotal)
      const txType = pointsNum > 0 ? 'MANUAL_ADD' : 'MANUAL_SUBTRACT'

      await prisma.$transaction([
        prisma.loyaltyPoints.update({
          where: { userId },
          data: {
            points: { increment: pointsNum },
            ...(pointsNum > 0 ? { totalEarned: { increment: pointsNum } } : { totalSpent: { increment: Math.abs(pointsNum) } }),
            tier: newTier,
          },
        }),
        prisma.loyaltyTransaction.create({
          data: {
            userId,
            points: pointsNum,
            type: txType,
            description: description || `Ajuste manual: ${pointsNum > 0 ? '+' : ''}${pointsNum} pontos`,
            reason: reason || description || 'Ajuste administrativo',
          },
        }),
      ])

      return NextResponse.json({ message: `Pontos ajustados: ${pointsNum > 0 ? '+' : ''}${pointsNum}` })
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  } catch (error) {
    console.error('Admin Loyalty POST error:', error)
    return NextResponse.json({ error: 'Erro ao processar ação' }, { status: 500 })
  }
}

// ═══ PUT — Atualizar recompensa ═══
export async function PUT(req: NextRequest) {
  const admin = getAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const { id, ...data } = await req.json()
    if (!id) return NextResponse.json({ error: 'ID da recompensa obrigatório' }, { status: 400 })

    const reward = await prisma.loyaltyReward.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.pointsCost !== undefined && { pointsCost: parseInt(data.pointsCost) }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.value !== undefined && { value: parseFloat(data.value) }),
        ...(data.active !== undefined && { active: data.active }),
        ...(data.stock !== undefined && { stock: data.stock ? parseInt(data.stock) : null }),
        ...(data.imageEmoji !== undefined && { imageEmoji: data.imageEmoji }),
      },
    })
    return NextResponse.json({ reward })
  } catch (error) {
    console.error('Admin Loyalty PUT error:', error)
    return NextResponse.json({ error: 'Erro ao atualizar recompensa' }, { status: 500 })
  }
}

// ═══ DELETE — Desativar recompensa ═══
export async function DELETE(req: NextRequest) {
  const admin = getAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

    await prisma.loyaltyReward.update({
      where: { id },
      data: { active: false },
    })
    return NextResponse.json({ message: 'Recompensa desativada' })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao desativar' }, { status: 500 })
  }
}
