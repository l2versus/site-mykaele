// app/api/auth/register/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, generateToken } from '@/lib/auth'
import { registerSchema } from '@/utils/validation'

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
