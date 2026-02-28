// src/app/api/admin/login/route.ts
import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'mykaele2025'
const JWT_SECRET = process.env.JWT_SECRET || 'sua-chave-jwt-aqui-alterada-em-producao'

export async function POST(request: Request) {
  try {
    const { password } = await request.json()

    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 })
    }

    const token = jwt.sign(
      { role: 'admin', name: 'Mykaele Procópio' },
      JWT_SECRET,
      { expiresIn: '7d' }
    )

    return NextResponse.json({ token, name: 'Mykaele Procópio' }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: 'Erro no login' }, { status: 500 })
  }
}
