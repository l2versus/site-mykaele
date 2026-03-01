// app/api/patient/referral/route.ts — Sistema de Indicação
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

function getUser(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  return verifyToken(auth.substring(7))
}

// Points configuration
const POINTS_CONFIG = {
  REFERRAL_BONUS: 200,        // Quem indicou ganha
  REFERRED_BONUS: 100,        // Quem foi indicado ganha
  SESSION_COMPLETE: 50,       // Por sessão realizada
  REVIEW_BONUS: 30,           // Por avaliação feita
  BIRTHDAY_BONUS: 150,        // Bônus de aniversário
  FIRST_SESSION_BONUS: 100,   // Primeira sessão
}

// Tier thresholds
const TIER_THRESHOLDS = { BRONZE: 0, SILVER: 500, GOLD: 1500, DIAMOND: 5000 }

function calculateTier(totalEarned: number): string {
  if (totalEarned >= TIER_THRESHOLDS.DIAMOND) return 'DIAMOND'
  if (totalEarned >= TIER_THRESHOLDS.GOLD) return 'GOLD'
  if (totalEarned >= TIER_THRESHOLDS.SILVER) return 'SILVER'
  return 'BRONZE'
}

async function awardPoints(userId: string, points: number, type: string, description: string, referenceId?: string) {
  // Use upsert to avoid race condition on loyalty record creation
  const loyalty = await prisma.loyaltyPoints.upsert({
    where: { userId },
    create: { userId, points: 0, totalEarned: 0, totalSpent: 0, tier: 'BRONZE' },
    update: {},
  })

  const newTotal = loyalty.totalEarned + points
  const newTier = calculateTier(newTotal)

  await prisma.$transaction([
    prisma.loyaltyPoints.update({
      where: { userId },
      data: {
        points: { increment: points },
        totalEarned: { increment: points },
        tier: newTier,
      },
    }),
    prisma.loyaltyTransaction.create({
      data: {
        userId,
        points,
        type,
        description,
        referenceId: referenceId || null,
      },
    }),
    // Award tier bonus if tier changed
    ...(newTier !== loyalty.tier
      ? [
          prisma.loyaltyTransaction.create({
            data: {
              userId,
              points: 50,
              type: 'TIER_BONUS',
              description: `🏆 Parabéns! Você subiu para o tier ${newTier}!`,
            },
          }),
          prisma.loyaltyPoints.update({
            where: { userId },
            data: { points: { increment: 50 }, totalEarned: { increment: 50 } },
          }),
        ]
      : []),
  ])

  return { points, newTier, tierChanged: newTier !== loyalty.tier }
}

// ═══ GET — Buscar código de indicação ═══
export async function GET(req: NextRequest) {
  const user = getUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    let referralCode = await prisma.referralCode.findUnique({ where: { userId: user.userId } })

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
      const year = new Date().getFullYear()
      const rand = Math.random().toString(36).substring(2, 5).toUpperCase()
      const code = `MYKA-${namePart}${rand}`

      referralCode = await prisma.referralCode.create({
        data: { userId: user.userId, code, active: true },
      })
    }

    // Get referral list
    const referrals = await prisma.referral.findMany({
      where: { referrerId: user.userId },
      orderBy: { createdAt: 'desc' },
    })

    // Get names of referred users
    const referredIds = referrals.map(r => r.referredUserId)
    const referredUsers = await prisma.user.findMany({
      where: { id: { in: referredIds } },
      select: { id: true, name: true },
    })
    const nameMap = Object.fromEntries(referredUsers.map(u => [u.id, u.name]))

    const referralList = referrals.map(r => ({
      id: r.id,
      referredName: nameMap[r.referredUserId]?.split(' ')[0] || 'Cliente',
      status: r.status,
      createdAt: r.createdAt,
      rewardedAt: r.rewardedAt,
    }))

    return NextResponse.json({
      code: referralCode.code,
      usageCount: referralCode.usageCount,
      referrals: referralList,
      pointsPerReferral: POINTS_CONFIG.REFERRAL_BONUS,
    })
  } catch (error) {
    console.error('Referral GET error:', error)
    return NextResponse.json({ error: 'Erro ao buscar dados de indicação' }, { status: 500 })
  }
}

// ═══ POST — Aplicar código de indicação (no signup/primeiro acesso) ═══
export async function POST(req: NextRequest) {
  const user = getUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const { action, referralCode, appointmentId } = await req.json()

    // ─── APPLY REFERRAL CODE ───
    if (action === 'apply_code') {
      if (!referralCode) return NextResponse.json({ error: 'Código obrigatório' }, { status: 400 })

      // Check if already referred
      const existing = await prisma.referral.findUnique({ where: { referredUserId: user.userId } })
      if (existing) {
        return NextResponse.json({ error: 'Você já utilizou um código de indicação' }, { status: 400 })
      }

      // Find referral code
      const codeRecord = await prisma.referralCode.findUnique({ where: { code: referralCode.toUpperCase() } })
      if (!codeRecord || !codeRecord.active) {
        return NextResponse.json({ error: 'Código de indicação inválido' }, { status: 404 })
      }

      // Can't refer yourself
      if (codeRecord.userId === user.userId) {
        return NextResponse.json({ error: 'Você não pode usar seu próprio código' }, { status: 400 })
      }

      // Create referral
      const referral = await prisma.referral.create({
        data: {
          referrerId: codeRecord.userId,
          referredUserId: user.userId,
          referralCodeId: codeRecord.id,
          status: 'CONFIRMED',
        },
      })

      // Update usage count
      await prisma.referralCode.update({
        where: { id: codeRecord.id },
        data: { usageCount: { increment: 1 } },
      })

      // Award points to BOTH parties
      const referrerProfile = await prisma.user.findUnique({
        where: { id: codeRecord.userId },
        select: { name: true },
      })
      const referredProfile = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { name: true },
      })

      await awardPoints(
        codeRecord.userId,
        POINTS_CONFIG.REFERRAL_BONUS,
        'REFERRAL_BONUS',
        `✨ Indicação de ${referredProfile?.name?.split(' ')[0] || 'novo cliente'}`,
        referral.id
      )

      await awardPoints(
        user.userId,
        POINTS_CONFIG.REFERRED_BONUS,
        'REFERRED_BONUS',
        `🎁 Bônus de boas-vindas! Indicado(a) por ${referrerProfile?.name?.split(' ')[0] || 'amigo(a)'}`,
        referral.id
      )

      // Mark referral as rewarded
      await prisma.referral.update({
        where: { id: referral.id },
        data: { status: 'REWARDED', rewardedAt: new Date() },
      })

      return NextResponse.json({
        message: `🎉 Código aplicado! Você ganhou ${POINTS_CONFIG.REFERRED_BONUS} pontos de boas-vindas!`,
        pointsEarned: POINTS_CONFIG.REFERRED_BONUS,
      })
    }

    // ─── AWARD SESSION POINTS ─── (called internally after appointment completion)
    if (action === 'award_session') {
      await awardPoints(
        user.userId,
        POINTS_CONFIG.SESSION_COMPLETE,
        'SESSION_COMPLETE',
        '💆 Pontos por sessão realizada',
        appointmentId
      )
      return NextResponse.json({ pointsEarned: POINTS_CONFIG.SESSION_COMPLETE })
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  } catch (error) {
    console.error('Referral POST error:', error)
    return NextResponse.json({ error: 'Erro ao processar indicação' }, { status: 500 })
  }
}
