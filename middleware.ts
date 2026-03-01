// middleware.ts — Proteção de rotas + Segurança HTTPS
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const isProd = process.env.NODE_ENV === 'production'

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
const STATIC_PREFIXES = ['/_next', '/favicon', '/media', '/images', '/icon', '/apple-icon']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ═══ HTTPS REDIRECT (produção) ═══
  // Redireciona HTTP → HTTPS se o header x-forwarded-proto indicar HTTP
  if (isProd) {
    const proto = request.headers.get('x-forwarded-proto')
    const host = request.headers.get('host') || request.nextUrl.host
    if (proto === 'http') {
      const httpsUrl = `https://${host}${pathname}${request.nextUrl.search}`
      return NextResponse.redirect(httpsUrl, { status: 301 })
    }

    // Redirecionar www → sem www (canonical)
    if (host.startsWith('www.')) {
      const cleanHost = host.replace('www.', '')
      const canonicalUrl = `https://${cleanHost}${pathname}${request.nextUrl.search}`
      return NextResponse.redirect(canonicalUrl, { status: 301 })
    }
  }

  // Permitir rotas estáticas
  if (STATIC_PREFIXES.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Permitir rotas públicas exatas
  if (PUBLIC_PATHS.includes(pathname)) {
    const response = NextResponse.next()
    addSecurityHeaders(response)
    return response
  }

  // Adicionar headers de segurança em TODAS as respostas
  const response = NextResponse.next()
  addSecurityHeaders(response)

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

/**
 * Aplica headers de segurança essenciais na resposta.
 * Headers principais já estão no next.config.ts — aqui só os críticos para HTTPS.
 */
function addSecurityHeaders(response: NextResponse) {
  // HSTS — força HTTPS por 2 anos
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')

  // Remove server info
  response.headers.delete('X-Powered-By')
  response.headers.delete('Server')
}

export const config = {
  matcher: [
    /*
     * Aplica em tudo exceto:
     * - _next/static (arquivos estáticos)
     * - _next/image (otimização de imagem)
     * - favicon.ico (ícone do navegador)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
