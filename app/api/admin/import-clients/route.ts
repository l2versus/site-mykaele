// app/api/admin/import-clients/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken, hashPassword } from '@/lib/auth'

function getAdmin(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const user = verifyToken(auth.substring(7))
  return user?.role === 'ADMIN' ? user : null
}

interface ImportClient {
  name: string
  email: string
  phone?: string
  cpfRg?: string
  tempPassword: string
  // Pacote (opcional)
  packageOptionId?: string
  totalSessions?: number
  usedSessions?: number
  // Próximo agendamento (opcional)
  nextAppointmentDate?: string // ISO date
  nextAppointmentServiceId?: string
  notes?: string
}

export async function POST(req: NextRequest) {
  const admin = getAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const { clients } = await req.json() as { clients: ImportClient[] }

    if (!clients || !Array.isArray(clients) || clients.length === 0) {
      return NextResponse.json({ error: 'Lista de clientes é obrigatória' }, { status: 400 })
    }

    const results: { name: string; email: string; status: 'created' | 'error' | 'exists'; error?: string }[] = []

    for (const client of clients) {
      try {
        // Validar campos obrigatórios
        if (!client.name || !client.email || !client.tempPassword) {
          results.push({ name: client.name || '?', email: client.email || '?', status: 'error', error: 'Nome, email e senha temporária são obrigatórios' })
          continue
        }

        // Verificar se email já existe
        const existing = await prisma.user.findUnique({ where: { email: client.email } })
        if (existing) {
          results.push({ name: client.name, email: client.email, status: 'exists', error: 'Email já cadastrado' })
          continue
        }

        // Hash da senha temporária
        const hashedPassword = await hashPassword(client.tempPassword)

        // Criar usuário com forcePasswordChange = true
        const user = await prisma.user.create({
          data: {
            name: client.name,
            email: client.email,
            phone: client.phone || null,
            cpfRg: client.cpfRg || null,
            password: hashedPassword,
            role: 'PATIENT',
            forcePasswordChange: true,
          },
        })

        // Criar pacote se informado
        if (client.packageOptionId && client.totalSessions) {
          const pkgOption = await prisma.packageOption.findUnique({
            where: { id: client.packageOptionId },
          })
          if (pkgOption) {
            await prisma.package.create({
              data: {
                userId: user.id,
                packageOptionId: client.packageOptionId,
                totalSessions: client.totalSessions,
                usedSessions: client.usedSessions || 0,
                status: 'ACTIVE',
              },
            })
          }
        }

        // Criar próximo agendamento se informado
        if (client.nextAppointmentDate && client.nextAppointmentServiceId) {
          const service = await prisma.service.findUnique({
            where: { id: client.nextAppointmentServiceId },
          })
          if (service) {
            const scheduledAt = new Date(client.nextAppointmentDate)
            const endAt = new Date(scheduledAt.getTime() + service.duration * 60 * 1000)
            await prisma.appointment.create({
              data: {
                userId: user.id,
                serviceId: service.id,
                scheduledAt,
                endAt,
                type: 'RETURN',
                status: 'CONFIRMED',
                notes: client.notes || 'Importado do cadastro existente',
                price: service.priceReturn || service.price,
                paymentMethod: 'PACKAGE',
              },
            })
          }
        }

        // Criar código de indicação
        const firstName = client.name.split(' ')[0].toUpperCase()
        const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase()
        const referralCode = `MYKA-${firstName}${randomSuffix}`

        await prisma.referralCode.create({
          data: {
            userId: user.id,
            code: referralCode,
            active: true,
          },
        }).catch(() => {
          // Se der conflito no código, tenta novamente com outro sufixo
          const retry = `MYKA-${firstName}${Date.now().toString(36).toUpperCase()}`
          return prisma.referralCode.create({
            data: { userId: user.id, code: retry, active: true },
          })
        })

        // Inicializar pontos de fidelidade
        await prisma.loyaltyPoints.upsert({
          where: { userId: user.id },
          create: { userId: user.id, points: 0, totalEarned: 0, totalSpent: 0, tier: 'BRONZE' },
          update: {},
        })

        results.push({ name: client.name, email: client.email, status: 'created' })
      } catch (err) {
        console.error(`Erro ao importar ${client.email}:`, err)
        results.push({
          name: client.name || '?',
          email: client.email || '?',
          status: 'error',
          error: err instanceof Error ? err.message : 'Erro desconhecido',
        })
      }
    }

    const created = results.filter(r => r.status === 'created').length
    const errors = results.filter(r => r.status === 'error').length
    const exists = results.filter(r => r.status === 'exists').length

    return NextResponse.json({
      message: `Importação concluída: ${created} criados, ${exists} já existentes, ${errors} erros`,
      created,
      exists,
      errors,
      results,
    })
  } catch (error) {
    console.error('Import clients error:', error)
    return NextResponse.json({ error: 'Erro ao importar clientes' }, { status: 500 })
  }
}

// GET: Retorna serviços e pacotes disponíveis para o formulário de importação
export async function GET(req: NextRequest) {
  const admin = getAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const [services, packageOptions] = await Promise.all([
      prisma.service.findMany({
        where: { active: true },
        select: { id: true, name: true, duration: true, price: true, priceReturn: true },
        orderBy: { name: 'asc' },
      }),
      prisma.packageOption.findMany({
        where: { active: true },
        include: { service: { select: { name: true } } },
        orderBy: { name: 'asc' },
      }),
    ])

    return NextResponse.json({ services, packageOptions })
  } catch (error) {
    console.error('Import clients GET error:', error)
    return NextResponse.json({ error: 'Erro ao buscar dados' }, { status: 500 })
  }
}
