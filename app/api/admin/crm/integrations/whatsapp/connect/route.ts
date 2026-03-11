// app/api/admin/crm/integrations/whatsapp/connect/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { evolutionApi } from '@/lib/evolution-api'
import { encryptCredentials } from '@/lib/crypto'
import { createAuditLog, CRM_ACTIONS } from '@/lib/audit'

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const payload = verifyToken(token)
  if (!payload || payload.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { tenantId } = await req.json()
  if (!tenantId) return NextResponse.json({ error: 'tenantId obrigatório' }, { status: 400 })

  try {
    // Verificar se já existe canal
    let channel = await prisma.crmChannel.findFirst({
      where: { tenantId, type: 'whatsapp' },
    })

    const instanceName = `crm-${tenantId.slice(0, 12)}`
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/webhooks/evolution`

    if (!channel) {
      // Criar instância na Evolution API
      const result = await evolutionApi.createInstance(instanceName, webhookUrl)

      // Criar canal no banco com credenciais criptografadas
      channel = await prisma.crmChannel.create({
        data: {
          tenantId,
          type: 'whatsapp',
          name: 'WhatsApp Principal',
          instanceId: result.instance.instanceName,
          credentials: process.env.ENCRYPTION_KEY
            ? encryptCredentials({ instanceName: result.instance.instanceName, instanceId: result.instance.instanceId })
            : { instanceName: result.instance.instanceName },
          isActive: true,
        },
      })
    }

    // Gerar QR Code
    const qr = await evolutionApi.getQrCode(channel.instanceId ?? instanceName)

    createAuditLog({
      tenantId,
      userId: payload.userId,
      action: CRM_ACTIONS.INTEGRATION_CONNECTED,
      details: { provider: 'whatsapp', instanceId: channel.instanceId },
    })

    return NextResponse.json({
      qrCode: qr.base64,
      instanceId: channel.instanceId,
    })
  } catch (err) {
    console.error('[whatsapp] Falha na conexão:', err instanceof Error ? err.message : err)
    return NextResponse.json(
      { error: 'Falha ao conectar com a Evolution API. Verifique se o serviço está rodando.' },
      { status: 502 },
    )
  }
}
