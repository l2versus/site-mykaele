'use server'

import { z } from 'zod'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { evolutionApi } from '@/lib/evolution-api'
import { createAuditLog, CRM_ACTIONS } from '@/lib/audit'

// ━━━ Types ━━━

interface ActionResult<T = undefined> {
  ok: boolean
  error?: string
  data?: T
}

type ConnectionState = 'open' | 'close' | 'connecting' | 'unknown'

interface ConnectionStatus {
  state: ConnectionState
  instanceName: string | null
  instanceId: string | null
}

interface QrCodeData {
  base64: string
  code: string
  instanceName: string
}

// ━━━ Helpers ━━━

async function getAdminPayload() {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return null

  const payload = verifyToken(token)
  if (!payload || payload.role !== 'ADMIN') return null
  return payload
}

async function resolveTenantId(): Promise<string | null> {
  const value = process.env.DEFAULT_TENANT_ID
  if (!value) return null

  // Tentar por slug primeiro, depois por ID
  const tenant = await prisma.crmTenant.findUnique({ where: { slug: value } })
  if (tenant) return tenant.id

  const tenantById = await prisma.crmTenant.findUnique({ where: { id: value } })
  return tenantById?.id ?? null
}

async function getChannelForTenant(tenantId: string) {
  return prisma.crmChannel.findFirst({
    where: { tenantId, type: 'whatsapp', isActive: true },
    select: { id: true, instanceId: true, name: true },
  })
}

// ━━━ Actions ━━━

/** Busca o status atual da conexão WhatsApp do tenant */
export async function getWhatsAppStatus(): Promise<ActionResult<ConnectionStatus>> {
  const payload = await getAdminPayload()
  if (!payload) return { ok: false, error: 'Não autorizado' }

  const tenantId = await resolveTenantId()
  if (!tenantId) return { ok: false, error: 'Tenant não configurado' }

  const channel = await getChannelForTenant(tenantId)
  if (!channel?.instanceId) {
    return {
      ok: true,
      data: { state: 'close', instanceName: null, instanceId: null },
    }
  }

  try {
    const statusPromise = evolutionApi.getStatus(channel.instanceId)
    // Timeout rápido para não travar a UI
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 3_000)
    )
    const status = await Promise.race([statusPromise, timeoutPromise])
    return {
      ok: true,
      data: {
        state: (status.instance.state as ConnectionState) || 'unknown',
        instanceName: channel.instanceId,
        instanceId: channel.id,
      },
    }
  } catch {
    // Se a Evolution API não responder, tratar como desconectado
    return {
      ok: true,
      data: {
        state: 'close',
        instanceName: channel.instanceId,
        instanceId: channel.id,
      },
    }
  }
}

/** Gera QR Code para conectar o WhatsApp. Cria instância se não existir. */
export async function connectWhatsApp(): Promise<ActionResult<QrCodeData>> {
  const payload = await getAdminPayload()
  if (!payload) return { ok: false, error: 'Não autorizado' }

  const tenantId = await resolveTenantId()
  if (!tenantId) return { ok: false, error: 'Tenant não configurado' }

  let channel = await getChannelForTenant(tenantId)

  // Se não existe canal, criar instância na Evolution API + canal no banco
  if (!channel?.instanceId) {
    const webhookUrl = process.env.EVOLUTION_WEBHOOK_URL
      || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/webhooks/evolution`

    const instanceName = `crm-${tenantId.slice(0, 12)}-${Date.now()}`

    try {
      const created = await evolutionApi.createInstance(instanceName, webhookUrl)

      // Criar ou atualizar canal no banco
      if (channel) {
        await prisma.crmChannel.update({
          where: { id: channel.id },
          data: { instanceId: created.instance.instanceName },
        })
      } else {
        await prisma.crmChannel.create({
          data: {
            tenantId,
            type: 'whatsapp',
            name: 'WhatsApp Principal',
            instanceId: created.instance.instanceName,
            isActive: true,
          },
        })
      }

      channel = await getChannelForTenant(tenantId)
    } catch (err) {
      console.error('[whatsapp-connection] Erro ao criar instância:', err instanceof Error ? err.message : err)
      return { ok: false, error: 'Falha ao criar instância na Evolution API. Verifique se o serviço está ativo.' }
    }
  }

  if (!channel?.instanceId) {
    return { ok: false, error: 'Falha ao obter instância' }
  }

  try {
    const qr = await evolutionApi.getQrCode(channel.instanceId)

    createAuditLog({
      tenantId,
      userId: payload.userId,
      action: CRM_ACTIONS.INTEGRATION_CONNECTED,
      details: { step: 'qr_generated', instanceId: channel.instanceId },
    })

    return {
      ok: true,
      data: {
        base64: qr.base64,
        code: qr.code,
        instanceName: channel.instanceId,
      },
    }
  } catch (err) {
    console.error('[whatsapp-connection] Erro ao gerar QR:', err instanceof Error ? err.message : err)
    return { ok: false, error: 'Falha ao gerar QR Code. A instância pode já estar conectada.' }
  }
}

/** Desconecta a instância WhatsApp (logout) */
export async function disconnectWhatsApp(): Promise<ActionResult> {
  const payload = await getAdminPayload()
  if (!payload) return { ok: false, error: 'Não autorizado' }

  const tenantId = await resolveTenantId()
  if (!tenantId) return { ok: false, error: 'Tenant não configurado' }

  const channel = await getChannelForTenant(tenantId)
  if (!channel?.instanceId) {
    return { ok: false, error: 'Nenhuma instância configurada' }
  }

  try {
    await evolutionApi.logoutInstance(channel.instanceId)

    createAuditLog({
      tenantId,
      userId: payload.userId,
      action: CRM_ACTIONS.INTEGRATION_DISCONNECTED,
      details: { instanceId: channel.instanceId },
    })

    return { ok: true }
  } catch (err) {
    console.error('[whatsapp-connection] Erro ao desconectar:', err instanceof Error ? err.message : err)
    return { ok: false, error: 'Falha ao desconectar. Tente novamente.' }
  }
}

/** Reinicia a instância (útil para resolver problemas de conexão) */
export async function restartWhatsApp(): Promise<ActionResult> {
  const payload = await getAdminPayload()
  if (!payload) return { ok: false, error: 'Não autorizado' }

  const tenantId = await resolveTenantId()
  if (!tenantId) return { ok: false, error: 'Tenant não configurado' }

  const channel = await getChannelForTenant(tenantId)
  if (!channel?.instanceId) {
    return { ok: false, error: 'Nenhuma instância configurada' }
  }

  try {
    await evolutionApi.restartInstance(channel.instanceId)
    return { ok: true }
  } catch (err) {
    console.error('[whatsapp-connection] Erro ao reiniciar:', err instanceof Error ? err.message : err)
    return { ok: false, error: 'Falha ao reiniciar instância.' }
  }
}
