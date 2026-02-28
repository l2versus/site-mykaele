import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { sendPackageNotification } from '@/lib/whatsapp'

function getUser(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  return verifyToken(auth.substring(7))
}

export async function POST(req: NextRequest) {
  const user = getUser(req)
  if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })

  try {
    const { serviceName, packageName, totalSessions, sessions } = await req.json()

    const client = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { name: true, phone: true },
    })

    const formattedSessions = (sessions || []).map((s: { date: string; time: string }) => {
      const dt = new Date(s.date + 'T12:00:00')
      return {
        date: dt.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }),
        time: s.time,
      }
    })

    const result = await sendPackageNotification({
      clientName: client?.name || 'Cliente',
      clientPhone: client?.phone || null,
      serviceName: serviceName || 'Servico',
      packageName: packageName || 'Pacote',
      totalSessions: totalSessions || formattedSessions.length,
      sessions: formattedSessions,
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('Package notification error:', error)
    return NextResponse.json({ error: 'Erro ao enviar notificacao' }, { status: 500 })
  }
}
