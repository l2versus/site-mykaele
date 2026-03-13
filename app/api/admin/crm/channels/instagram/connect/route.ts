// app/api/admin/crm/channels/instagram/connect/route.ts — OAuth Instagram via Meta
// Gera URL de autorização e troca código por token de acesso.
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { encryptCredentials } from '@/lib/crypto'
import { createAuditLog, CRM_ACTIONS } from '@/lib/audit'

const GRAPH_API = 'https://graph.facebook.com/v21.0'

/**
 * GET — Retorna URL de OAuth para conectar Instagram
 */
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const appId = process.env.INSTAGRAM_APP_ID
    if (!appId) {
      return NextResponse.json({ error: 'INSTAGRAM_APP_ID não configurado' }, { status: 500 })
    }

    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/admin/crm/channels/instagram/connect`
    const scopes = 'instagram_basic,instagram_manage_messages,pages_show_list,pages_messaging'

    const authUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&response_type=code&state=instagram_connect`

    return NextResponse.json({ authUrl })
  } catch (err) {
    console.error('[instagram-connect] GET error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

/**
 * POST — Troca código OAuth por access token e salva credenciais
 */
export async function POST(req: NextRequest) {
  try {
    const authToken = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!authToken) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(authToken)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { code } = await req.json()
    if (!code) return NextResponse.json({ error: 'Código de autorização é obrigatório' }, { status: 400 })

    const appId = process.env.INSTAGRAM_APP_ID
    const appSecret = process.env.INSTAGRAM_APP_SECRET
    if (!appId || !appSecret) {
      return NextResponse.json({ error: 'Credenciais do Instagram não configuradas' }, { status: 500 })
    }

    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/admin/crm/channels/instagram/connect`

    // 1. Trocar código por short-lived token
    const tokenRes = await fetch(
      `${GRAPH_API}/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`,
      { signal: AbortSignal.timeout(10_000) },
    )
    if (!tokenRes.ok) {
      const err = await tokenRes.text()
      return NextResponse.json({ error: `Falha ao obter token: ${err.slice(0, 200)}` }, { status: 400 })
    }
    const { access_token: shortToken } = await tokenRes.json()

    // 2. Trocar por long-lived token (60 dias)
    const longRes = await fetch(
      `${GRAPH_API}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortToken}`,
      { signal: AbortSignal.timeout(10_000) },
    )
    if (!longRes.ok) {
      return NextResponse.json({ error: 'Falha ao obter token de longa duração' }, { status: 400 })
    }
    const { access_token: longToken } = await longRes.json()

    // 3. Buscar Instagram Business Account via Pages
    const pagesRes = await fetch(
      `${GRAPH_API}/me/accounts?fields=id,name,instagram_business_account&access_token=${longToken}`,
      { signal: AbortSignal.timeout(10_000) },
    )
    if (!pagesRes.ok) {
      return NextResponse.json({ error: 'Falha ao buscar páginas' }, { status: 400 })
    }
    const pagesData = await pagesRes.json()
    const page = pagesData.data?.find((p: { instagram_business_account?: { id: string } }) => p.instagram_business_account)

    if (!page?.instagram_business_account) {
      return NextResponse.json({
        error: 'Nenhuma conta Instagram Business encontrada. Verifique se sua conta Instagram está vinculada a uma Página do Facebook.',
      }, { status: 400 })
    }

    const igAccountId = page.instagram_business_account.id
    const pageName = page.name

    // 4. Obter Page Access Token de longa duração
    const pageTokenRes = await fetch(
      `${GRAPH_API}/${page.id}?fields=access_token&access_token=${longToken}`,
      { signal: AbortSignal.timeout(10_000) },
    )
    const pageTokenData = await pageTokenRes.json()
    const pageAccessToken = pageTokenData.access_token

    // 5. Salvar canal no banco
    let tenantId = process.env.DEFAULT_TENANT_ID ?? ''
    const tenantById = await prisma.crmTenant.findUnique({ where: { id: tenantId } })
    if (!tenantById) {
      const tenantBySlug = await prisma.crmTenant.findUnique({ where: { slug: tenantId } })
      if (tenantBySlug) tenantId = tenantBySlug.id
    }

    const encrypted = encryptCredentials({
      accessToken: pageAccessToken,
      igAccountId,
      pageId: page.id,
      pageName,
    })

    await prisma.crmChannel.upsert({
      where: {
        id: await prisma.crmChannel.findFirst({
          where: { tenantId, type: 'instagram' },
        }).then(c => c?.id ?? 'new'),
      },
      create: {
        tenantId,
        type: 'instagram',
        name: `Instagram ${pageName}`,
        instanceId: igAccountId,
        credentials: encrypted,
        isActive: true,
      },
      update: {
        name: `Instagram ${pageName}`,
        instanceId: igAccountId,
        credentials: encrypted,
        isActive: true,
      },
    })

    // 6. Configurar webhook subscription (via App Dashboard — automático se app está em Live mode)

    createAuditLog({
      tenantId,
      userId: payload.userId,
      action: CRM_ACTIONS.INTEGRATION_CONNECTED,
      details: { provider: 'instagram', accountId: igAccountId, pageName },
    })

    return NextResponse.json({
      success: true,
      account: { id: igAccountId, name: pageName },
    })
  } catch (err) {
    console.error('[instagram-connect] POST error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
