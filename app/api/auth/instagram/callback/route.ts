import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateToken, hashPassword } from '@/lib/auth'
import { sendNewRegistrationNotification } from '@/lib/whatsapp'

/**
 * GET /api/auth/instagram/callback
 * Recebe o code do Instagram OAuth, troca por token, busca perfil e faz login/cadastro.
 */
export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get('code')
    const error = req.nextUrl.searchParams.get('error')
    const errorReason = req.nextUrl.searchParams.get('error_reason')

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin

    if (error || !code) {
      const msg = errorReason || error || 'Código não recebido'
      return NextResponse.redirect(`${baseUrl}/cliente?auth_error=${encodeURIComponent(msg)}`)
    }

    const appId = process.env.INSTAGRAM_APP_ID!
    const appSecret = process.env.INSTAGRAM_APP_SECRET!
    const redirectUri = `${baseUrl}/api/auth/instagram/callback`

    // 1. Trocar code por short-lived access_token
    const tokenBody = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code,
    })

    const tokenRes = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      body: tokenBody,
    })

    if (!tokenRes.ok) {
      const err = await tokenRes.text()
      console.error('[Instagram OAuth] Token exchange failed:', err)
      return NextResponse.redirect(`${baseUrl}/cliente?auth_error=Falha+ao+autenticar+com+Instagram`)
    }

    const tokenData = await tokenRes.json()
    // tokenData = { access_token, user_id }
    const accessToken = tokenData.access_token
    const instagramUserId = String(tokenData.user_id)

    // 2. Buscar perfil do usuário
    const profileRes = await fetch(
      `https://graph.instagram.com/me?fields=id,username&access_token=${accessToken}`
    )

    let username = ''
    if (profileRes.ok) {
      const profile = await profileRes.json()
      username = profile.username || ''
    }

    // 3. Buscar ou criar usuário
    let user = await prisma.user.findFirst({
      where: { instagramId: instagramUserId },
    })

    if (user) {
      // Usuário já vinculado ao Instagram — login direto
    } else {
      // Tentar encontrar por username como nome ou criar novo
      // Instagram não dá email, então criamos conta com email placeholder
      const placeholderEmail = `instagram_${instagramUserId}@placeholder.local`

      // Verificar se já existe um user com esse email placeholder
      user = await prisma.user.findUnique({ where: { email: placeholderEmail } })

      if (!user) {
        const randomPassword = await hashPassword(crypto.randomUUID())
        user = await prisma.user.create({
          data: {
            email: placeholderEmail,
            name: username || `Usuário Instagram`,
            password: randomPassword,
            instagramId: instagramUserId,
            role: 'PATIENT',
          },
        })

        // Notificar Mykaele via WhatsApp sobre novo cadastro
        sendNewRegistrationNotification({
          clientName: user.name || 'Sem nome',
          clientEmail: user.email,
          provider: 'instagram',
        }).catch(() => {})
      } else if (!user.instagramId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { instagramId: instagramUserId },
        })
      }
    }

    // 4. Gerar JWT
    const token = generateToken(user.id, user.email, user.role)

    // 5. Redirecionar com token
    const userData = encodeURIComponent(JSON.stringify({
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      avatar: user.avatar,
      instagramUsername: username || undefined,
      needsEmailUpdate: user.email.endsWith('@placeholder.local'),
    }))

    return NextResponse.redirect(
      `${baseUrl}/cliente?oauth_token=${token}&oauth_user=${userData}&oauth_provider=instagram`
    )
  } catch (err) {
    console.error('[Instagram OAuth] Callback error:', err)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin
    return NextResponse.redirect(`${baseUrl}/cliente?auth_error=Erro+interno+na+autenticação`)
  }
}
