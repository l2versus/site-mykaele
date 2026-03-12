// app/api/admin/crm/integrations/whatsapp/connect/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { evolutionApi } from '@/lib/evolution-api'
import { encryptCredentials } from '@/lib/crypto'
import { createAuditLog, CRM_ACTIONS } from '@/lib/audit'

async function resolveTenantId(value: string): Promise<string | null> {
  const byId = await prisma.crmTenant.findUnique({ where: { id: value }, select: { id: true } })
  if (byId) return byId.id

  const bySlug = await prisma.crmTenant.findUnique({ where: { slug: value }, select: { id: true } })
  return bySlug?.id ?? null
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const payload = verifyToken(token)
  if (!payload || payload.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { tenantId: rawTenantId } = await req.json()
  if (!rawTenantId) return NextResponse.json({ error: 'tenantId obrigatório' }, { status: 400 })

  const tenantId = await resolveTenantId(rawTenantId)
  if (!tenantId) {
    return NextResponse.json(
      { error: 'Tenant não encontrado. Execute o seed: npx tsx prisma/seeds/crm-pipeline.ts' },
      { status: 404 },
    )
  }

  try {
    const instanceName = `crm-${tenantId.slice(0, 12)}`
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/webhooks/evolution`

    // Passo 1: Garantir que instância existe na Evolution API
    let resolvedInstanceName = instanceName
    try {
      const existing = await evolutionApi.fetchInstances()
      const found = existing.find(i => i.instance.instanceName === instanceName)
      if (found) {
        resolvedInstanceName = found.instance.instanceName
      } else {
        const result = await evolutionApi.createInstance(instanceName, webhookUrl)
        resolvedInstanceName = result.instance.instanceName
      }
    } catch (fetchErr) {
      // Se fetchInstances falhar, tentar criar diretamente
      const fetchMsg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
      console.error('[whatsapp/connect] fetchInstances falhou:', fetchMsg)
      try {
        const result = await evolutionApi.createInstance(instanceName, webhookUrl)
        resolvedInstanceName = result.instance.instanceName
      } catch (createErr) {
        const msg = createErr instanceof Error ? createErr.message : String(createErr)
        if (!msg.includes('already') && !msg.includes('exist') && !msg.includes('409')) {
          throw createErr
        }
        // Instância já existe — usar nome padrão
      }
    }

    // Passo 2: Sincronizar canal no banco
    let channel = await prisma.crmChannel.findFirst({
      where: { tenantId, type: 'whatsapp' },
    })

    if (!channel) {
      channel = await prisma.crmChannel.create({
        data: {
          tenantId,
          type: 'whatsapp',
          name: 'WhatsApp Principal',
          instanceId: resolvedInstanceName,
          credentials: process.env.ENCRYPTION_KEY
            ? encryptCredentials({ instanceName: resolvedInstanceName })
            : { instanceName: resolvedInstanceName },
          isActive: true,
        },
      })
    } else if (channel.instanceId !== resolvedInstanceName) {
      // Atualizar instanceId se mudou
      channel = await prisma.crmChannel.update({
        where: { id: channel.id },
        data: { instanceId: resolvedInstanceName },
      })
    }

    // Passo 3: Gerar QR Code
    let qr: { base64: string; code: string }
    try {
      qr = await evolutionApi.getQrCode(resolvedInstanceName)
    } catch (qrErr) {
      const qrMsg = qrErr instanceof Error ? qrErr.message : String(qrErr)
      // Se 404, instância sumiu — deletar canal e pedir retry
      if (qrMsg.includes('404')) {
        await prisma.crmChannel.deleteMany({ where: { tenantId, type: 'whatsapp' } })
        return NextResponse.json(
          { error: 'Instância não encontrada na Evolution API. Clique em "Tentar novamente".' },
          { status: 502 },
        )
      }
      throw qrErr
    }

    createAuditLog({
      tenantId,
      userId: payload.userId,
      action: CRM_ACTIONS.INTEGRATION_CONNECTED,
      details: { provider: 'whatsapp', instanceId: resolvedInstanceName },
    })

    return NextResponse.json({
      qrCode: qr.base64,
      instanceId: resolvedInstanceName,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[whatsapp/connect] Falha:', message)

    // Erros específicos para debug — mostrar detalhes úteis
    if (message.includes('EVOLUTION_API_URL')) {
      return NextResponse.json({ error: 'Evolution API URL não configurada no .env' }, { status: 500 })
    }
    if (message.includes('EVOLUTION_API_KEY')) {
      return NextResponse.json({ error: 'Evolution API Key não configurada no .env' }, { status: 500 })
    }
    if (message.includes('401') || message.includes('403')) {
      return NextResponse.json(
        { error: `API Key da Evolution API inválida. Verifique EVOLUTION_API_KEY.` },
        { status: 502 },
      )
    }
    if (message.includes('inalcançável') || message.includes('timeout') || message.includes('ECONNREFUSED')) {
      return NextResponse.json(
        { error: `Evolution API não respondeu (${process.env.EVOLUTION_API_URL}). Verifique se o serviço está acessível a partir do servidor Coolify.` },
        { status: 502 },
      )
    }

    return NextResponse.json(
      { error: `Falha: ${message.slice(0, 300)}` },
      { status: 502 },
    )
  }
}
