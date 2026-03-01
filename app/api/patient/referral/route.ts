// app/api/patient/referral/route.ts — Sistema de Indicação + Link Personalizado + Desconto
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

// ═══ DISCOUNT TIERS — baseado em indicações confirmadas ═══
// Teto máximo: 15% para não perder dinheiro
const DISCOUNT_TIERS = [
  { min: 1,  max: 2,  discount: 3,  label: 'Iniciante' },
  { min: 3,  max: 5,  discount: 5,  label: 'Conectada' },
  { min: 6,  max: 9,  discount: 8,  label: 'Influenciadora' },
  { min: 10, max: 19, discount: 12, label: 'Embaixadora' },
  { min: 20, max: 999, discount: 15, label: 'Embaixadora VIP' },
]
const MAX_DISCOUNT_PERCENT = 15 // Teto absoluto

function getDiscountInfo(confirmedReferrals: number) {
  if (confirmedReferrals === 0) return { discount: 0, label: 'Sem indicações', nextTier: DISCOUNT_TIERS[0], remaining: 1 }
  
  const current = DISCOUNT_TIERS.find(t => confirmedReferrals >= t.min && confirmedReferrals <= t.max)
  const currentIdx = current ? DISCOUNT_TIERS.indexOf(current) : -1
  const nextTier = currentIdx < DISCOUNT_TIERS.length - 1 ? DISCOUNT_TIERS[currentIdx + 1] : null
  
  return {
    discount: Math.min(current?.discount || 0, MAX_DISCOUNT_PERCENT),
    label: current?.label || 'Iniciante',
    nextTier,
    remaining: nextTier ? nextTier.min - confirmedReferrals : 0,
  }
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

// ═══ GET — Buscar código de indicação + desconto + ranking ═══
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

    const confirmedCount = referrals.filter(r => r.status === 'CONFIRMED' || r.status === 'REWARDED').length

    // Get names of referred users
    const referredIds = referrals.map(r => r.referredUserId)
    const referredUsers = referredIds.length > 0 ? await prisma.user.findMany({
      where: { id: { in: referredIds } },
      select: { id: true, name: true },
    }) : []
    const nameMap = Object.fromEntries(referredUsers.map(u => [u.id, u.name]))

    const referralList = referrals.map(r => ({
      id: r.id,
      referredName: nameMap[r.referredUserId]?.split(' ')[0] || 'Cliente',
      status: r.status,
      createdAt: r.createdAt,
      rewardedAt: r.rewardedAt,
    }))

    // ═══ Discount info ═══
    const discountInfo = getDiscountInfo(confirmedCount)

    // ═══ Ranking de indicações (top 10 + posição do user) ═══
    const allCodes = await prisma.referralCode.findMany({
      where: { usageCount: { gt: 0 } },
      orderBy: { usageCount: 'desc' },
      take: 20,
    })
    const rankUserIds = allCodes.map(c => c.userId)
    const rankUsers = rankUserIds.length > 0 ? await prisma.user.findMany({
      where: { id: { in: rankUserIds } },
      select: { id: true, name: true },
    }) : []
    const rankNameMap = Object.fromEntries(rankUsers.map(u => [u.id, u.name]))

    const ranking = allCodes.slice(0, 10).map((c, i) => ({
      position: i + 1,
      displayName: rankNameMap[c.userId]?.split(' ')[0] || 'Cliente',
      referralCount: c.usageCount,
      isCurrentUser: c.userId === user.userId,
    }))

    // Posição do usuário se não está no top 10
    let myPosition = ranking.find(r => r.isCurrentUser)?.position || null
    if (!myPosition && referralCode.usageCount > 0) {
      const countAbove = allCodes.filter(c => c.usageCount > referralCode!.usageCount).length
      myPosition = countAbove + 1
    }

    // Link promocional personalizado
    const promoLink = `https://mykaprocopio.com.br/ref/${referralCode.code}`

    return NextResponse.json({
      code: referralCode.code,
      usageCount: referralCode.usageCount,
      referrals: referralList,
      confirmedCount,
      pointsPerReferral: POINTS_CONFIG.REFERRAL_BONUS,
      // Novo: desconto e ranking
      discount: discountInfo,
      discountTiers: DISCOUNT_TIERS,
      maxDiscount: MAX_DISCOUNT_PERCENT,
      ranking,
      myPosition,
      promoLink,
    })
  } catch (error) {
    console.error('Referral GET error:', error)
    return NextResponse.json({ error: 'Erro ao buscar dados de indicação' }, { status: 500 })
  }
}

// ═══ POST — Aplicar código / Personalizar link / Award session ═══
export async function POST(req: NextRequest) {
  const user = getUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const { action, referralCode, appointmentId, customCode } = await req.json()

    // ─── CUSTOMIZE REFERRAL CODE (10 chars) ───
    if (action === 'customize_code') {
      if (!customCode || typeof customCode !== 'string') {
        return NextResponse.json({ error: 'Código obrigatório' }, { status: 400 })
      }

      const cleaned = customCode.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 10)
      if (cleaned.length < 3) {
        return NextResponse.json({ error: 'Código deve ter pelo menos 3 caracteres (letras e números)' }, { status: 400 })
      }
      if (cleaned.length > 10) {
        return NextResponse.json({ error: 'Código deve ter no máximo 10 caracteres' }, { status: 400 })
      }

      // Check if code already taken
      const existing = await prisma.referralCode.findUnique({ where: { code: cleaned } })
      if (existing && existing.userId !== user.userId) {
        return NextResponse.json({ error: 'Este código já está em uso. Tente outro!' }, { status: 409 })
      }

      // Update or create
      const current = await prisma.referralCode.findUnique({ where: { userId: user.userId } })
      if (current) {
        await prisma.referralCode.update({
          where: { userId: user.userId },
          data: { code: cleaned },
        })
      } else {
        await prisma.referralCode.create({
          data: { userId: user.userId, code: cleaned, active: true },
        })
      }

      return NextResponse.json({
        message: `Código personalizado! Seu novo link: mykaprocopio.com.br/ref/${cleaned}`,
        code: cleaned,
        promoLink: `https://mykaprocopio.com.br/ref/${cleaned}`,
      })
    }

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
