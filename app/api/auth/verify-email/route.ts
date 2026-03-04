import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/auth/verify-email?token=XXX
 * Verifica o email do usuário e redireciona para o app
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin

  if (!token) {
    return NextResponse.redirect(`${baseUrl}/cliente?email_error=Token+inválido`)
  }

  try {
    // Buscar token
    const verification = await prisma.emailVerificationToken.findUnique({
      where: { token }
    })

    if (!verification) {
      return NextResponse.redirect(`${baseUrl}/cliente?email_error=Link+inválido+ou+expirado`)
    }

    // Verificar se já foi usado
    if (verification.usedAt) {
      return NextResponse.redirect(`${baseUrl}/cliente?email_success=Email+já+confirmado`)
    }

    // Verificar expiração (24h)
    if (new Date() > verification.expiresAt) {
      return NextResponse.redirect(`${baseUrl}/cliente?email_error=Link+expirado.+Solicite+um+novo.`)
    }

    // Marcar token como usado e verificar email do usuário
    await prisma.$transaction([
      prisma.emailVerificationToken.update({
        where: { id: verification.id },
        data: { usedAt: new Date() }
      }),
      prisma.user.update({
        where: { id: verification.userId },
        data: {
          emailVerified: true,
          emailVerifiedAt: new Date(),
          // Atualizar email se mudou (ex: Google login depois vinculou telefone)
          email: verification.email
        }
      })
    ])

    // Redirecionar para o app com mensagem de sucesso
    return NextResponse.redirect(`${baseUrl}/cliente?email_success=Email+confirmado+com+sucesso!+🎉`)

  } catch (error) {
    console.error('[Verify Email] Error:', error)
    return NextResponse.redirect(`${baseUrl}/cliente?email_error=Erro+ao+verificar+email`)
  }
}
