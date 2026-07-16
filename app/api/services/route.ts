import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

// Rota pública (middleware.ts → PUBLIC_PATHS). Serve dois consumidores:
//  - anônimo  → vitrine/funil público, SEM honorários
//  - autenticado (Bearer) → fluxos de /cliente e /admin, COM honorários
//
// Regra de negócio: Res. COFFITO 424/2013, Art. 40, I veda ao fisioterapeuta divulgar
// valor de honorário fora do local da assistência. Preço só após identificação.
// A seleção é por ALLOWLIST: campo novo no model Service não vaza por omissão.

function toPublicService(service: {
  id: string
  name: string
  description: string | null
  duration: number
  active: boolean
  isAddon: boolean
  createdAt: Date
  updatedAt: Date
  packageOptions: Array<{ id: string; serviceId: string; name: string; sessions: number; active: boolean }>
}) {
  return {
    id: service.id,
    name: service.name,
    description: service.description,
    duration: service.duration,
    active: service.active,
    isAddon: service.isAddon,
    createdAt: service.createdAt,
    updatedAt: service.updatedAt,
    packageOptions: service.packageOptions.map((option) => ({
      id: option.id,
      serviceId: option.serviceId,
      name: option.name,
      sessions: option.sessions,
      active: option.active,
    })),
  }
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    const isAuthenticated = token ? verifyToken(token) !== null : false

    const services = await prisma.service.findMany({
      where: { active: true },
      include: { packageOptions: { where: { active: true } } },
      orderBy: { createdAt: 'asc' },
    })

    if (isAuthenticated) {
      // Resposta personalizada: nunca pode ser guardada por cache compartilhado (CDN).
      return NextResponse.json(services, {
        headers: {
          'Cache-Control': 'private, no-store',
          Vary: 'Authorization',
        },
      })
    }

    return NextResponse.json(services.map(toPublicService), {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        Vary: 'Authorization',
      },
    })
  } catch (error) {
    console.error('Services GET error:', error)
    return NextResponse.json({ error: 'Erro ao buscar serviços' }, { status: 500 })
  }
}
