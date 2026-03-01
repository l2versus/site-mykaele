// app/api/auth/change-password/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken, hashPassword, verifyPassword } from '@/lib/auth'

function getUser(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  return verifyToken(auth.substring(7))
}

export async function POST(request: NextRequest) {
  try {
    const authUser = getUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { currentPassword, newPassword } = await request.json()

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { error: 'A nova senha deve ter pelo menos 6 caracteres' },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: authUser.userId },
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    // Se não é troca obrigatória, exigir senha atual
    if (!user.forcePasswordChange) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: 'Senha atual é obrigatória' },
          { status: 400 }
        )
      }
      const valid = await verifyPassword(currentPassword, user.password)
      if (!valid) {
        return NextResponse.json(
          { error: 'Senha atual incorreta' },
          { status: 400 }
        )
      }
    }

    // Atualizar senha e desmarcar forcePasswordChange
    const hashed = await hashPassword(newPassword)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        forcePasswordChange: false,
      },
    })

    return NextResponse.json({
      message: 'Senha alterada com sucesso',
    })
  } catch (error) {
    console.error('Erro ao alterar senha:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
