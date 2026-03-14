'use server'

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

/** Constrói a URL do webhook baseado nas variáveis de ambiente */
function resolveWebhookUrl(): string {
  return process.env.EVOLUTION_WEBHOOK_URL
    || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/webhooks/evolution`
}

/** Garante que a instância existe na Evolution API. Reutiliza existente ou cria nova. */
async function ensureEvolutionInstance(tenantId: string): Promise<string> {
  const instanceName = `crm-${tenantId.slice(0, 12)}`
  const webhookUrl = resolveWebhookUrl()

  // 1. Verificar se instância já existe na Evolution API
  try {
    const instances = await evolutionApi.fetchInstances()
    const existing = instances.find(i => i.instance.instanceName === instanceName)
    if (existing) {
      // SEMPRE configurar webhook — pode ter sido criada sem ou com URL errada
      await configureWebhook(instanceName, webhookUrl)
      return existing.instance.instanceName
    }
  } catch (err) {
    console.error('[whatsapp-connection] fetchInstances falhou:', err instanceof Error ? err.message : err)
    // Continua para tentar criar
  }

  // 2. Criar nova instância
  const created = await evolutionApi.createInstance(instanceName, webhookUrl)

  // 3. Configurar webhook explicitamente (createInstance pode não setar corretamente)
  await configureWebhook(instanceName, webhookUrl)

  return created.instance.instanceName
}

/** Configura o webhook na Evolution API com os eventos corretos */
async function configureWebhook(instanceName: string, webhookUrl: string): Promise<void> {
  try {
    await evolutionApi.setWebhook(instanceName, webhookUrl)
    console.error(`[whatsapp-connection] Webhook configurado: ${webhookUrl}`)
  } catch (err) {
    // Não bloquear conexão se falhar — apenas logar
    console.error('[whatsapp-connection] Falha ao configurar webhook:', err instanceof Error ? err.message : err)
  }
}

/** Gera QR Code para conectar o WhatsApp. Cria instância se não existir. */
export async function connectWhatsApp(): Promise<ActionResult<QrCodeData>> {
  const payload = await getAdminPayload()
  if (!payload) return { ok: false, error: 'Não autorizado' }

  const tenantId = await resolveTenantId()
  if (!tenantId) return { ok: false, error: 'Tenant não configurado' }

  let channel = await getChannelForTenant(tenantId)

  // Passo 1: Garantir que a instância existe na Evolution API
  let resolvedInstanceName: string
  try {
    resolvedInstanceName = await ensureEvolutionInstance(tenantId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[whatsapp-connection] Erro ao garantir instância:', msg)

    // Mensagens de erro específicas para diagnóstico
    if (msg.includes('inalcançável') || msg.includes('timeout')) {
      return { ok: false, error: `Evolution API não respondeu. Verifique se ${process.env.EVOLUTION_API_URL} está acessível a partir do servidor.` }
    }
    if (msg.includes('401') || msg.includes('403')) {
      return { ok: false, error: 'API Key da Evolution API inválida. Verifique EVOLUTION_API_KEY.' }
    }
    if (msg.includes('409') || msg.includes('already') || msg.includes('exist')) {
      // Instância já existe mas fetchInstances não a encontrou — tentar usar o nome padrão
      resolvedInstanceName = `crm-${tenantId.slice(0, 12)}`
    } else {
      return { ok: false, error: `Falha na Evolution API: ${msg.slice(0, 200)}` }
    }
  }

  // Passo 2: Sincronizar canal no banco de dados
  try {
    if (channel) {
      if (channel.instanceId !== resolvedInstanceName) {
        await prisma.crmChannel.update({
          where: { id: channel.id },
          data: { instanceId: resolvedInstanceName },
        })
      }
    } else {
      await prisma.crmChannel.create({
        data: {
          tenantId,
          type: 'whatsapp',
          name: 'WhatsApp Principal',
          instanceId: resolvedInstanceName,
          isActive: true,
        },
      })
    }
    channel = await getChannelForTenant(tenantId)
  } catch (err) {
    console.error('[whatsapp-connection] Erro ao salvar canal:', err instanceof Error ? err.message : err)
    return { ok: false, error: 'Falha ao salvar configuração no banco de dados.' }
  }

  if (!channel?.instanceId) {
    return { ok: false, error: 'Falha ao obter instância após criação' }
  }

  // Passo 3: Gerar QR Code
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
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[whatsapp-connection] Erro ao gerar QR:', msg)

    // Se getQrCode falha com 404, a instância pode ter sido deletada — tentar recriar
    if (msg.includes('404')) {
      try {
        // Deletar canal antigo e recriar
        await prisma.crmChannel.deleteMany({ where: { tenantId, type: 'whatsapp' } })
        return connectWhatsApp() // Recursão segura (1 nível: canal foi deletado)
      } catch {
        return { ok: false, error: 'Instância não encontrada na Evolution API. Tente novamente.' }
      }
    }

    // Se a instância já está conectada, getQrCode pode retornar erro
    if (msg.includes('already connected') || msg.includes('open')) {
      return { ok: false, error: 'O WhatsApp já está conectado nesta instância. Recarregue a página.' }
    }

    return { ok: false, error: `Falha ao gerar QR Code: ${msg.slice(0, 200)}` }
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

/** Diagnostica o webhook — verifica se está configurado corretamente */
export async function diagnoseWebhook(): Promise<ActionResult<{
  webhookUrl: string | null
  expectedUrl: string
  isCorrect: boolean
  events: string[]
  fixed: boolean
}>> {
  const payload = await getAdminPayload()
  if (!payload) return { ok: false, error: 'Não autorizado' }

  const tenantId = await resolveTenantId()
  if (!tenantId) return { ok: false, error: 'Tenant não configurado' }

  const channel = await getChannelForTenant(tenantId)
  if (!channel?.instanceId) {
    return { ok: false, error: 'Nenhuma instância configurada' }
  }

  const expectedUrl = resolveWebhookUrl()

  try {
    const webhook = await evolutionApi.findWebhook(channel.instanceId)
    const currentUrl = webhook?.url ?? null
    const events = webhook?.events ?? []
    const isCorrect = currentUrl === expectedUrl && events.length > 0

    let fixed = false
    if (!isCorrect) {
      // Auto-corrigir webhook
      await configureWebhook(channel.instanceId, expectedUrl)
      fixed = true
    }

    return {
      ok: true,
      data: { webhookUrl: currentUrl, expectedUrl, isCorrect, events, fixed },
    }
  } catch (err) {
    return { ok: false, error: `Falha ao diagnosticar: ${err instanceof Error ? err.message : String(err)}` }
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
