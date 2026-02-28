import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/auth/instagram
 * Redireciona para o Instagram OAuth (Facebook Login for Instagram)
 *
 * Requisitos:
 * 1. Criar app em https://developers.facebook.com
 * 2. Adicionar "Instagram Basic Display" ou "Facebook Login" ao app
 * 3. Configurar redirect URI no painel do Meta
 */
export async function GET(req: NextRequest) {
  const appId = process.env.INSTAGRAM_APP_ID
  if (!appId) {
    return NextResponse.json({ error: 'INSTAGRAM_APP_ID não configurado' }, { status: 500 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin
  const redirectUri = `${baseUrl}/api/auth/instagram/callback`

  const mode = req.nextUrl.searchParams.get('mode') || 'login'

  // Instagram Basic Display API
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    scope: 'user_profile',
    response_type: 'code',
    state: mode,
  })

  return NextResponse.redirect(`https://api.instagram.com/oauth/authorize?${params.toString()}`)
}
