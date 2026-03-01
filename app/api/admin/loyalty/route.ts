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

    // ─── ADJUST POINTS ───
    if (action === 'adjust_points') {
      const { userId, points, description } = body
      if (!userId || !points) {
        return NextResponse.json({ error: 'userId e points obrigatórios' }, { status: 400 })
      }

      const pointsNum = parseInt(points)
      let loyalty = await prisma.loyaltyPoints.findUnique({ where: { userId } })
      if (!loyalty) {
        loyalty = await prisma.loyaltyPoints.create({
          data: { userId, points: 0, totalEarned: 0, totalSpent: 0, tier: 'BRONZE' },
        })
      }

      const TIER_THRESHOLDS = { BRONZE: 0, SILVER: 500, GOLD: 1500, DIAMOND: 5000 }
      function calcTier(total: number) {
        if (total >= TIER_THRESHOLDS.DIAMOND) return 'DIAMOND'
        if (total >= TIER_THRESHOLDS.GOLD) return 'GOLD'
        if (total >= TIER_THRESHOLDS.SILVER) return 'SILVER'
        return 'BRONZE'
      }

      const newTotal = pointsNum > 0 ? loyalty.totalEarned + pointsNum : loyalty.totalEarned
      const newTier = calcTier(newTotal)

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
            type: 'ADMIN_ADJUSTMENT',
            description: description || `Ajuste administrativo: ${pointsNum > 0 ? '+' : ''}${pointsNum} pontos`,
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
