// middleware.ts — Proteção de rotas
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Rotas públicas que NÃO precisam de autenticação
const PUBLIC_PATHS = [
  '/',
  '/galeria-resultados',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/google',
  '/api/auth/google/callback',
  '/api/auth/instagram',
  '/api/auth/instagram/callback',
  '/api/services',
  '/api/booking/availability',
  '/api/payments/webhook',
]

// Prefixos de rotas estáticas
const STATIC_PREFIXES = ['/_next', '/favicon', '/media', '/images']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Permitir rotas estáticas
  if (STATIC_PREFIXES.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Permitir rotas públicas exatas
  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next()
  }

  // Adicionar headers de segurança em TODAS as respostas
  const response = NextResponse.next()
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('X-XSS-Protection', '1; mode=block')

  // APIs protegidas: /api/patient/*, /api/admin/*
  if (pathname.startsWith('/api/patient/') || pathname.startsWith('/api/admin/')) {
    const auth = request.headers.get('authorization')
    if (!auth || !auth.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    // A validação real do JWT é feita dentro de cada rota (verifyToken)
    // O middleware só garante que o header existe
  }

  // API de payments (exceto webhook que é público)
  if (pathname.startsWith('/api/payments/') && pathname !== '/api/payments/webhook') {
    // checkout e success precisam de auth
    if (pathname.includes('/checkout') || pathname.includes('/success')) {
      const auth = request.headers.get('authorization')
      if (!auth || !auth.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Aplica em tudo exceto:
     * - _next/static (arquivos estáticos)
     * - _next/image (otimização de imagem)
     * - favicon.ico
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
