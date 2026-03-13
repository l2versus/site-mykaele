// app/api/admin/crm/channels/telegram/connect/route.ts — Conectar bot Telegram
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { encryptCredentials } from '@/lib/crypto'
import { getTelegramBotInfo, setTelegramWebhook } from '@/lib/channels/telegram'
import { createAuditLog, CRM_ACTIONS } from '@/lib/audit'

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { botToken } = await req.json()
    if (!botToken) {
      return NextResponse.json({ error: 'botToken é obrigatório' }, { status: 400 })
    }

    let tenantId = process.env.DEFAULT_TENANT_ID ?? ''
    const tenantById = await prisma.crmTenant.findUnique({ where: { id: tenantId } })
    if (!tenantById) {
      const tenantBySlug = await prisma.crmTenant.findUnique({ where: { slug: tenantId } })
      if (tenantBySlug) tenantId = tenantBySlug.id
    }

    // 1. Testar conexão com getMe
    const botInfo = await getTelegramBotInfo(botToken)

    // 2. Configurar webhook automaticamente
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || ''
    const webhookUrl = `${baseUrl}/api/webhooks/telegram`
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET

    await setTelegramWebhook(botToken, webhookUrl, webhookSecret)

    // 3. Salvar canal com credenciais criptografadas
    const encrypted = encryptCredentials({ botToken })

    const channel = await prisma.crmChannel.upsert({
      where: {
        id: (await prisma.crmChannel.findFirst({
          where: { tenantId, type: 'telegram' },
        }))?.id ?? '',
      },
      update: {
        credentials: encrypted,
        instanceId: String(botInfo.id),
        name: `@${botInfo.username}`,
        isActive: true,
      },
      create: {
        tenantId,
        type: 'telegram',
        name: `@${botInfo.username}`,
        instanceId: String(botInfo.id),
        credentials: encrypted,
        isActive: true,
      },
    })

    createAuditLog({
      tenantId,
      userId: payload.userId,
      action: CRM_ACTIONS.INTEGRATION_CONNECTED,
      entityId: channel.id,
      details: { channel: 'telegram', botUsername: botInfo.username },
    })

    return NextResponse.json({
      success: true,
      channel: {
        id: channel.id,
        name: channel.name,
        botUsername: botInfo.username,
        botFirstName: botInfo.firstName,
      },
    })
  } catch (err) {
    console.error('[telegram-connect] Error:', err instanceof Error ? err.message : err)
    const message = err instanceof Error ? err.message : 'Erro ao conectar Telegram'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
