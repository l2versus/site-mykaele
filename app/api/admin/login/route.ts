// src/app/api/admin/login/route.ts
import { NextResponse } from 'next/server'
import { generateToken } from '@/lib/auth'
import { rateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

export async function POST(request: Request) {
  try {
    // Rate limit: 5 attempts per minute per IP
    const ip = getClientIP(request)
    const rl = rateLimit(`admin-login:${ip}`, 5, 60_000)
    if (!rl.allowed) return rateLimitResponse(rl.resetIn)

    const { password } = await request.json()

    const adminPassword = process.env.ADMIN_PASSWORD
    if (!adminPassword) {
      console.error('ADMIN_PASSWORD env var not configured')
      return NextResponse.json({ error: 'Configuração inválida' }, { status: 500 })
    }

    if (password !== adminPassword) {
      return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 })
    }

    const token = generateToken('admin', 'admin@mykaprocopio.com.br', 'ADMIN')

    return NextResponse.json({ token, name: 'Mykaele Procópio' }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: 'Erro no login' }, { status: 500 })
  }
}
