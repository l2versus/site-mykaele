// app/api/crm/invite/accept/route.ts — Accept team invite and create user account
import { NextRequest, NextResponse } from 'next/server'
import { hashPassword } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json()

    if (!token || !password?.trim()) {
      return NextResponse.json({ error: 'Token e senha são obrigatórios' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Senha deve ter no mínimo 6 caracteres' }, { status: 400 })
    }

    // Find the invite
    const member = await prisma.crmTeamMember.findUnique({
      where: { inviteToken: token },
    })

    if (!member) {
      return NextResponse.json({ error: 'Convite inválido ou expirado' }, { status: 404 })
    }

    if (member.inviteStatus === 'accepted') {
      return NextResponse.json({ error: 'Este convite já foi aceito' }, { status: 400 })
    }

    // Check if invite is older than 7 days
    if (member.invitedAt) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      if (member.invitedAt < sevenDaysAgo) {
        return NextResponse.json({ error: 'Convite expirado. Peça um novo convite ao administrador.' }, { status: 410 })
      }
    }

    // Check if user already exists with this email
    const existingUser = await prisma.user.findUnique({
      where: { email: member.email },
    })

    if (existingUser) {
      // Link existing user to team member
      await prisma.crmTeamMember.update({
        where: { id: member.id },
        data: {
          userId: existingUser.id,
          inviteStatus: 'accepted',
          inviteToken: null,
          joinedAt: new Date(),
        },
      })

      return NextResponse.json({ success: true, message: 'Conta vinculada com sucesso' })
    }

    // Create new user + link in a transaction
    const hashedPassword = await hashPassword(password)

    await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: member.email,
          name: member.name,
          phone: member.phone,
          password: hashedPassword,
          role: 'ADMIN',
        },
      })

      await tx.crmTeamMember.update({
        where: { id: member.id },
        data: {
          userId: newUser.id,
          inviteStatus: 'accepted',
          inviteToken: null,
          joinedAt: new Date(),
        },
      })
    })

    return NextResponse.json({ success: true, message: 'Conta criada com sucesso' })
  } catch (err) {
    console.error('[invite/accept] Error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// GET — validate token (used by the invite page to check if token is valid)
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token')
    if (!token) {
      return NextResponse.json({ error: 'Token obrigatório' }, { status: 400 })
    }

    const member = await prisma.crmTeamMember.findUnique({
      where: { inviteToken: token },
      select: { name: true, email: true, role: true, inviteStatus: true, invitedAt: true },
    })

    if (!member) {
      return NextResponse.json({ valid: false, error: 'Convite inválido' }, { status: 404 })
    }

    if (member.inviteStatus === 'accepted') {
      return NextResponse.json({ valid: false, error: 'Convite já aceito' }, { status: 400 })
    }

    // Check expiry
    if (member.invitedAt) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      if (member.invitedAt < sevenDaysAgo) {
        return NextResponse.json({ valid: false, error: 'Convite expirado' }, { status: 410 })
      }
    }

    return NextResponse.json({
      valid: true,
      name: member.name,
      email: member.email,
      role: member.role,
    })
  } catch (err) {
    console.error('[invite/validate] Error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
