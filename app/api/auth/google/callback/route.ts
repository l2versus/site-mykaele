import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateToken, hashPassword } from '@/lib/auth'

/**
 * GET /api/auth/google/callback
 * Recebe o code do Google OAuth, troca por token, busca perfil e faz login/cadastro.
 * Redireciona para /cliente com token via fragment (#).
 */
export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get('code')
    const state = req.nextUrl.searchParams.get('state') || 'login'
    const error = req.nextUrl.searchParams.get('error')

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin

    if (error || !code) {
      return NextResponse.redirect(`${baseUrl}/cliente?auth_error=${encodeURIComponent(error || 'Código não recebido')}`)
    }

    const clientId = process.env.GOOGLE_CLIENT_ID!
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET!
    const redirectUri = `${baseUrl}/api/auth/google/callback`

    // 1. Trocar code por access_token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenRes.ok) {
      const err = await tokenRes.text()
      console.error('[Google OAuth] Token exchange failed:', err)
      return NextResponse.redirect(`${baseUrl}/cliente?auth_error=Falha+ao+autenticar+com+Google`)
    }

    const tokenData = await tokenRes.json()
    const accessToken = tokenData.access_token

    // 2. Buscar perfil do usuário
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!profileRes.ok) {
      return NextResponse.redirect(`${baseUrl}/cliente?auth_error=Falha+ao+obter+perfil+Google`)
    }

    const profile = await profileRes.json()
    // profile = { id, email, name, given_name, family_name, picture, verified_email }

    if (!profile.email) {
      return NextResponse.redirect(`${baseUrl}/cliente?auth_error=Email+não+disponível+na+conta+Google`)
    }

    // 3. Buscar ou criar usuário
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { googleId: profile.id },
          { email: profile.email },
        ],
      },
    })

    if (user) {
      // Sempre atualizar avatar do Google e vincular googleId
      const updateData: Record<string, unknown> = {}
      if (!user.googleId) updateData.googleId = profile.id
      if (profile.picture) updateData.avatar = profile.picture
      // Preencher nome se estava vazio
      if (!user.name && profile.name) updateData.name = profile.name

      if (Object.keys(updateData).length > 0) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: updateData,
        })
      }
    } else {
      // Criar novo usuário (cadastro automático via Google)
      const randomPassword = await hashPassword(crypto.randomUUID())
      user = await prisma.user.create({
        data: {
          email: profile.email,
          name: profile.name || profile.given_name || 'Usuário Google',
          password: randomPassword,
          googleId: profile.id,
          avatar: profile.picture || null,
          role: 'PATIENT',
        },
      })
    }

    // 4. Gerar JWT
    const token = generateToken(user.id, user.email, user.role)

    // 5. Redirecionar para /cliente com token na URL (será capturado pelo frontend)
    const userData = encodeURIComponent(JSON.stringify({
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      avatar: user.avatar,
    }))

    return NextResponse.redirect(
      `${baseUrl}/cliente?oauth_token=${token}&oauth_user=${userData}&oauth_provider=google`
    )
  } catch (err) {
    console.error('[Google OAuth] Callback error:', err)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin
    return NextResponse.redirect(`${baseUrl}/cliente?auth_error=Erro+interno+na+autenticação`)
  }
}
