// app/api/patient/loyalty/route.ts — Programa de Fidelidade
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

function getUser(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  return verifyToken(auth.substring(7))
}

// ═══ Tier thresholds ═══
const TIER_THRESHOLDS = {
  BRONZE: 0,
  SILVER: 500,
  GOLD: 1500,
  DIAMOND: 5000,
}

function calculateTier(totalEarned: number): string {
  if (totalEarned >= TIER_THRESHOLDS.DIAMOND) return 'DIAMOND'
  if (totalEarned >= TIER_THRESHOLDS.GOLD) return 'GOLD'
  if (totalEarned >= TIER_THRESHOLDS.SILVER) return 'SILVER'
  return 'BRONZE'
}

// ═══ GET — Buscar dados de fidelidade do usuário ═══
export async function GET(req: NextRequest) {
  const user = getUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const section = searchParams.get('section') // 'overview' | 'history' | 'ranking' | 'rewards'

    // Ensure loyalty record exists (upsert to avoid race condition)
    const loyalty = await prisma.loyaltyPoints.upsert({
      where: { userId: user.userId },
      create: { userId: user.userId, points: 0, totalEarned: 0, totalSpent: 0, tier: 'BRONZE' },
      update: {},
    })

    // ─── OVERVIEW ───
    if (!section || section === 'overview') {
      // Count referrals
      const referralCount = await prisma.referral.count({
        where: { referrerId: user.userId },
      })
      const confirmedReferrals = await prisma.referral.count({
        where: { referrerId: user.userId, status: 'REWARDED' },
      })

      // Get referral code
      let referralCode = await prisma.referralCode.findUnique({
        where: { userId: user.userId },
      })

      // Get user name for code generation
      if (!referralCode) {
        const profile = await prisma.user.findUnique({
          where: { id: user.userId },
          select: { name: true },
        })
        const namePart = (profile?.name || 'CLIENTE')
          .split(' ')[0]
          .toUpperCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .substring(0, 8)
        const code = `MYKA-${namePart}${new Date().getFullYear()}`

        referralCode = await prisma.referralCode.create({
          data: { userId: user.userId, code, active: true },
        })
      }

      // Next tier info
      const currentTier = loyalty.tier
      const tiers = ['BRONZE', 'SILVER', 'GOLD', 'DIAMOND']
      const currentIndex = tiers.indexOf(currentTier)
      const nextTier = currentIndex < tiers.length - 1 ? tiers[currentIndex + 1] : null
      const nextTierThreshold = nextTier ? TIER_THRESHOLDS[nextTier as keyof typeof TIER_THRESHOLDS] : null
      const progressToNext = nextTierThreshold
        ? Math.min(100, Math.round((loyalty.totalEarned / nextTierThreshold) * 100))
        : 100

      return NextResponse.json({
        loyalty: {
          points: loyalty.points,
          totalEarned: loyalty.totalEarned,
          totalSpent: loyalty.totalSpent,
          tier: loyalty.tier,
          nextTier,
          nextTierThreshold,
          progressToNext,
        },
        referralCode: referralCode.code,
        referralCount,
        confirmedReferrals,
      })
    }

    // ─── HISTORY ───
    if (section === 'history') {
      const page = parseInt(searchParams.get('page') || '1')
      const limit = 20
      const transactions = await prisma.loyaltyTransaction.findMany({
        where: { userId: user.userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      })
      const total = await prisma.loyaltyTransaction.count({
        where: { userId: user.userId },
      })
      return NextResponse.json({ transactions, total, page, totalPages: Math.ceil(total / limit) })
    }

    // ─── RANKING ───
    if (section === 'ranking') {
      const allMembers = await prisma.loyaltyPoints.findMany({
        orderBy: { totalEarned: 'desc' },
        take: 20,
      })

      // Get user names
      const userIds = allMembers.map(m => m.userId)
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, avatar: true },
      })
      const userMap = Object.fromEntries(users.map(u => [u.id, u]))

      const ranking = allMembers.map((m, idx) => {
        const u = userMap[m.userId]
        // Anonymize names for privacy: show first name + initial
        const fullName = u?.name || 'Cliente'
        const parts = fullName.split(' ')
        const displayName = parts.length > 1
          ? `${parts[0]} ${parts[parts.length - 1][0]}.`
          : parts[0]

        return {
          position: idx + 1,
          displayName,
          avatar: u?.avatar || null,
          tier: m.tier,
          totalEarned: m.totalEarned,
          isCurrentUser: m.userId === user.userId,
        }
      })

      // Find current user position if not in top 20
      const myPosition = ranking.find(r => r.isCurrentUser)
      let myRank = null
      if (!myPosition) {
        const above = await prisma.loyaltyPoints.count({
          where: { totalEarned: { gt: loyalty.totalEarned } },
        })
        myRank = {
          position: above + 1,
          displayName: 'Você',
          tier: loyalty.tier,
          totalEarned: loyalty.totalEarned,
          isCurrentUser: true,
        }
      }

      return NextResponse.json({ ranking, myRank })
    }

    // ─── REWARDS ───
    if (section === 'rewards') {
      const rewards = await prisma.loyaltyReward.findMany({
        where: { active: true },
        orderBy: { pointsCost: 'asc' },
      })
      return NextResponse.json({ rewards, userPoints: loyalty.points })
    }

    return NextResponse.json({ error: 'Seção inválida' }, { status: 400 })
  } catch (error) {
    console.error('Loyalty GET error:', error)
    return NextResponse.json({ error: 'Erro ao buscar dados de fidelidade' }, { status: 500 })
  }
}

// ═══ POST — Resgatar recompensa ═══
export async function POST(req: NextRequest) {
  const user = getUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const { action, rewardId } = await req.json()

    if (action === 'redeem') {
      if (!rewardId) return NextResponse.json({ error: 'rewardId obrigatório' }, { status: 400 })

      // Use interactive transaction to prevent race conditions on stock and points
      const result = await prisma.$transaction(async (tx) => {
        const reward = await tx.loyaltyReward.findUnique({ where: { id: rewardId } })
        if (!reward || !reward.active) {
          throw new Error('NOT_FOUND')
        }

        // Check stock atomically inside transaction
        if (reward.stock !== null && reward.stock <= 0) {
          throw new Error('OUT_OF_STOCK')
        }

        // Check points atomically inside transaction
        const loyalty = await tx.loyaltyPoints.findUnique({ where: { userId: user!.userId } })
        if (!loyalty || loyalty.points < reward.pointsCost) {
          throw new Error('INSUFFICIENT_POINTS')
        }

        // Process redemption atomically
        await tx.loyaltyPoints.update({
          where: { userId: user!.userId },
          data: {
            points: { decrement: reward.pointsCost },
            totalSpent: { increment: reward.pointsCost },
          },
        })

        await tx.loyaltyTransaction.create({
          data: {
            userId: user!.userId,
            points: -reward.pointsCost,
            type: 'REDEMPTION',
            description: `Resgate: ${reward.name}`,
            referenceId: reward.id,
          },
        })

        // Apply reward value as credit to user balance
        await tx.user.update({
          where: { id: user!.userId },
          data: { balance: { increment: reward.value } },
        })

        // Decrease stock if limited
        if (reward.stock !== null) {
          await tx.loyaltyReward.update({ where: { id: rewardId }, data: { stock: { decrement: 1 } } })
        }

        return reward
      })

      return NextResponse.json({
        message: `🎉 Resgate confirmado! ${result.name} - R$${result.value.toFixed(2)} adicionados ao seu saldo.`,
        reward: result.name,
        pointsSpent: result.pointsCost,
      })
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  } catch (error: any) {
    if (error?.message === 'NOT_FOUND') return NextResponse.json({ error: 'Recompensa não encontrada' }, { status: 404 })
    if (error?.message === 'OUT_OF_STOCK') return NextResponse.json({ error: 'Recompensa esgotada' }, { status: 400 })
    if (error?.message === 'INSUFFICIENT_POINTS') return NextResponse.json({ error: 'Pontos insuficientes' }, { status: 400 })
    console.error('Loyalty POST error:', error)
    return NextResponse.json({ error: 'Erro ao processar resgate' }, { status: 500 })
  }
}
