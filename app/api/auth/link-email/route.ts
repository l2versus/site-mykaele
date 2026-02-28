import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken, generateToken } from '@/lib/auth'

/**
 * POST /api/auth/link-email
 * Permite que usuários logados via Instagram (sem email real) atualizem seu email.
 * Body: { email: string, name?: string, phone?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('authorization')
    if (!auth?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const decoded = verifyToken(auth.substring(7))
    if (!decoded) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }

    const { email, name, phone } = await req.json()

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }

    // Verificar se email já está em uso por outro usuario
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing && existing.id !== decoded.userId) {
      return NextResponse.json({ error: 'Este email já está cadastrado. Tente fazer login com email e vincular o Instagram no seu perfil.' }, { status: 409 })
    }

    const user = await prisma.user.update({
      where: { id: decoded.userId },
      data: {
        email,
        ...(name ? { name } : {}),
        ...(phone ? { phone } : {}),
      },
    })

    // Gerar novo token com email atualizado
    const token = generateToken(user.id, user.email, user.role)

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
        avatar: user.avatar,
      },
    })
  } catch (error) {
    console.error('[LinkEmail] Error:', error)
    return NextResponse.json({ error: 'Erro ao atualizar email' }, { status: 500 })
  }
}
