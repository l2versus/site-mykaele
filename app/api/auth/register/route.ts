// app/api/auth/register/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, generateToken } from '@/lib/auth'
import { registerSchema } from '@/utils/validation'
import { sendNewRegistrationNotification } from '@/lib/whatsapp'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validar entrada
    const validation = registerSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados de entrada inválidos', issues: validation.error.issues },
        { status: 400 }
      )
    }

    const { name, email, password } = validation.data

    // Sempre PATIENT via registro público (admin criado manualmente)
    const role = 'PATIENT'

    // Verificar se usuário já existe
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email já registrado' },
        { status: 409 }
      )
    }

    // Hash da senha
    const hashedPassword = await hashPassword(password)

    // Criar usuário
    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        role,
      },
    })

    // Gerar token
    const token = generateToken(user.id, user.email, user.role)

    // ═══ Auto-apply referral code if provided ═══
    const referralCode = body.referralCode?.trim()?.toUpperCase()
    if (referralCode) {
      try {
        const codeRecord = await prisma.referralCode.findUnique({ where: { code: referralCode } })
        if (codeRecord && codeRecord.active && codeRecord.userId !== user.id) {
          const calcTier = (t: number) => t >= 5000 ? 'DIAMOND' : t >= 1500 ? 'GOLD' : t >= 500 ? 'SILVER' : 'BRONZE'

          // Create referral record
          const referral = await prisma.referral.create({
            data: {
              referrerId: codeRecord.userId,
              referredUserId: user.id,
              referralCodeId: codeRecord.id,
              status: 'REWARDED',
              rewardedAt: new Date(),
            },
          })

          // Update usage count
          await prisma.referralCode.update({ where: { id: codeRecord.id }, data: { usageCount: { increment: 1 } } })

          // Award points to referrer (200 pts) — use upsert to avoid race conditions
          const referrerLoyalty = await prisma.loyaltyPoints.upsert({
            where: { userId: codeRecord.userId },
            create: { userId: codeRecord.userId, points: 0, totalEarned: 0, totalSpent: 0, tier: 'BRONZE' },
            update: {},
          })
          const referrerNewTier = calcTier(referrerLoyalty.totalEarned + 200)
          await prisma.$transaction([
            prisma.loyaltyPoints.update({ where: { userId: codeRecord.userId }, data: { points: { increment: 200 }, totalEarned: { increment: 200 }, tier: referrerNewTier } }),
            prisma.loyaltyTransaction.create({ data: { userId: codeRecord.userId, points: 200, type: 'REFERRAL_BONUS', description: `✨ Indicação de ${name.split(' ')[0]}`, referenceId: referral.id } }),
          ])

          // Award points to new user (100 pts) — use upsert in case loyalty record was already created
          await prisma.$transaction([
            prisma.loyaltyPoints.upsert({
              where: { userId: user.id },
              create: { userId: user.id, points: 100, totalEarned: 100, totalSpent: 0, tier: 'BRONZE' },
              update: { points: { increment: 100 }, totalEarned: { increment: 100 } },
            }),
            prisma.loyaltyTransaction.create({ data: { userId: user.id, points: 100, type: 'REFERRED_BONUS', description: '🎁 Bônus de boas-vindas por indicação!', referenceId: referral.id } }),
          ])
        }
      } catch (referralErr) {
        console.error('Referral auto-apply error (non-blocking):', referralErr)
      }
    }

    // Notificar Mykaele via WhatsApp
    sendNewRegistrationNotification({
      clientName: user.name || 'Sem nome',
      clientEmail: user.email,
      provider: 'email',
    }).catch(() => {}) // fire-and-forget

    return NextResponse.json(
      {
        message: 'Usuário registrado com sucesso',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        token,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Erro ao registrar:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
