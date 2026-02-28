import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/auth/google
 * Redireciona o usuário para a página de consentimento do Google OAuth 2.0
 */
export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: 'GOOGLE_CLIENT_ID não configurado' }, { status: 500 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin
  const redirectUri = `${baseUrl}/api/auth/google/callback`

  // Ler o "mode" da query string (login ou register) para passar como state
  const mode = req.nextUrl.searchParams.get('mode') || 'login'

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
    state: mode,
  })

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`)
}
