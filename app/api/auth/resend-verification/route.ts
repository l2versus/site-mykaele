import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { sendVerificationEmail, generateVerificationToken } from '@/lib/email'

/**
 * POST /api/auth/resend-verification
 * Reenvia email de verificação
 */
export async function POST(req: NextRequest) {
  try {
    // Verificar autenticação
    const auth = req.headers.get('authorization')
    if (!auth?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const decoded = verifyToken(auth.substring(7))
    if (!decoded) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }

    // Buscar usuário
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    // Verificar se já está verificado
    if (user.emailVerified) {
      return NextResponse.json({ error: 'Email já verificado' }, { status: 400 })
    }

    // Verificar cooldown (não enviar mais de 1 email por minuto)
    const recentToken = await prisma.emailVerificationToken.findFirst({
      where: {
        userId: user.id,
        createdAt: { gt: new Date(Date.now() - 60 * 1000) } // último minuto
      }
    })

    if (recentToken) {
      return NextResponse.json({ 
        error: 'Aguarde 1 minuto antes de solicitar novamente' 
      }, { status: 429 })
    }

    // Criar novo token
    const token = generateVerificationToken()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h

    await prisma.emailVerificationToken.create({
      data: {
        token,
        userId: user.id,
        email: user.email,
        expiresAt
      }
    })

    // Enviar email
    const result = await sendVerificationEmail(user.email, user.name, token)

    if (!result.success) {
      console.error('[Resend Verification] Email error:', result.error)
      return NextResponse.json({ 
        error: 'Erro ao enviar email. Tente novamente.' 
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Email de verificação enviado!' 
    })

  } catch (error) {
    console.error('[Resend Verification] Error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
