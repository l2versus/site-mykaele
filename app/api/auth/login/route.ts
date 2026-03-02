// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPassword, generateToken } from '@/lib/auth'
import { rateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 10 attempts per minute per IP
    const ip = getClientIP(request)
    const rl = rateLimit(`auth-login:${ip}`, 10, 60_000)
    if (!rl.allowed) return rateLimitResponse(rl.resetIn)

    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email e senha são obrigatórios' },
        { status: 400 }
      )
    }

    // Buscar usuário
    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Credenciais inválidas' },
        { status: 401 }
      )
    }

    // Verificar senha
    const passwordValid = await verifyPassword(password, user.password)

    if (!passwordValid) {
      return NextResponse.json(
        { error: 'Credenciais inválidas' },
        { status: 401 }
      )
    }

    // Gerar token
    const token = generateToken(user.id, user.email, user.role)

    return NextResponse.json(
      {
        message: 'Login realizado com sucesso',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          role: user.role,
          avatar: user.avatar,
          forcePasswordChange: user.forcePasswordChange,
        },
        token,
      },
      { status: 200 }
    )
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error('Erro ao fazer login:', errMsg, error)
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: process.env.NODE_ENV !== 'production' ? errMsg : undefined },
      { status: 500 }
    )
  }
}
