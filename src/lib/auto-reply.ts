// src/lib/auto-reply.ts — Auto-resposta para novos leads via WhatsApp
// Envia UMA vez por lead quando recebe a primeira mensagem.
// Config armazenada em CrmIntegration (provider: 'auto-reply').
// Rastreio via LeadActivity (type: 'AUTO_REPLY_SENT').
//
// FIX v2: markAutoReplySent() agora é chamado DEPOIS do envio com sucesso.
// Lock otimista via banco (findFirst + create) previne duplicação.

import { prisma } from '@/lib/prisma'
import { evolutionApi } from '@/lib/evolution-api'

interface AutoReplyConfig {
  enabled: boolean
  message: string
  delayMs: number // 3000-5000ms para parecer humano
}

const DEFAULT_CONFIG: AutoReplyConfig = {
  enabled: false,
  message: '',
  delayMs: 4000,
}

async function getAutoReplyConfig(tenantId: string): Promise<AutoReplyConfig | null> {
  const integration = await prisma.crmIntegration.findFirst({
    where: { tenantId, provider: 'auto-reply', isActive: true },
  })

  if (!integration) return null

  const creds = integration.credentials as Record<string, unknown> | null
  if (!creds) return null

  const config: AutoReplyConfig = {
    enabled: creds.enabled === true,
    message: typeof creds.message === 'string' ? creds.message : DEFAULT_CONFIG.message,
    delayMs: typeof creds.delayMs === 'number' ? creds.delayMs : DEFAULT_CONFIG.delayMs,
  }

  if (!config.enabled || !config.message.trim()) return null
  return config
}

async function alreadySentAutoReply(leadId: string): Promise<boolean> {
  const activity = await prisma.leadActivity.findFirst({
    where: { leadId, type: 'AUTO_REPLY_SENT' },
    select: { id: true },
  })
  return !!activity
}

/**
 * Lock otimista: tenta criar um registro de "tentando enviar".
 * Se outro processo já criou, retorna false (outra instância está enviando).
 * Se falhar no envio, limpa o lock.
 */
async function acquireAutoReplyLock(leadId: string): Promise<string | null> {
  // Verificar se já enviou ou está enviando
  const existing = await prisma.leadActivity.findFirst({
    where: {
      leadId,
      type: { in: ['AUTO_REPLY_SENT', 'AUTO_REPLY_SENDING'] },
    },
    select: { id: true, type: true },
  })

  if (existing) return null // Já enviou ou outro processo está enviando

  try {
    const lock = await prisma.leadActivity.create({
      data: {
        leadId,
        type: 'AUTO_REPLY_SENDING',
        payload: { lockedAt: new Date().toISOString() },
      },
    })
    return lock.id
  } catch {
    // Unique constraint ou race condition — outro processo ganhou
    return null
  }
}

async function finalizeAutoReplyLock(lockId: string, success: boolean, message: string): Promise<void> {
  if (success) {
    await prisma.leadActivity.update({
      where: { id: lockId },
      data: {
        type: 'AUTO_REPLY_SENT',
        payload: { message, sentAt: new Date().toISOString() },
      },
    }).catch(() => {})
  } else {
    // Falhou — remover lock para permitir retry
    await prisma.leadActivity.delete({
      where: { id: lockId },
    }).catch(() => {})
  }
}

function interpolateMessage(template: string, leadName: string): string {
  const firstName = leadName.split(' ')[0] || 'cliente'
  return template.replace(/\{\{nome\}\}/gi, firstName)
}

/**
 * Tenta enviar auto-reply para um lead.
 * RETORNA boolean indicando se conseguiu enviar (antes era void).
 *
 * Mudanças v2:
 * - Retorna boolean (não mais void)
 * - Lock otimista (não marca "enviado" antes de enviar)
 * - Se falha no envio, limpa o lock para permitir retry
 */
export async function tryAutoReply(params: {
  tenantId: string
  leadId: string
  leadName: string
  channelId: string
  remoteJid: string
  fromMe: boolean
}): Promise<boolean> {
  const { tenantId, leadId, leadName, channelId, remoteJid, fromMe } = params

  if (fromMe) return false

  try {
    // 1. Buscar config
    const config = await getAutoReplyConfig(tenantId)
    if (!config) return false

    // 2. Lock otimista — previne duplicação entre webhook e polling
    const lockId = await acquireAutoReplyLock(leadId)
    if (!lockId) return false // Já enviou ou outro processo está enviando

    // 3. Buscar instanceId
    const channel = await prisma.crmChannel.findUnique({
      where: { id: channelId },
      select: { instanceId: true },
    })
    if (!channel?.instanceId) {
      await finalizeAutoReplyLock(lockId, false, '')
      return false
    }

    // 4. Interpolar mensagem
    const finalMessage = interpolateMessage(config.message, leadName)

    // 5. Delay para parecer humano
    await new Promise(resolve => setTimeout(resolve, config.delayMs))

    // 6. Enviar via Evolution API
    let result: { key?: { id?: string } } | undefined
    try {
      result = await evolutionApi.sendText(channel.instanceId, remoteJid, finalMessage)
    } catch (sendErr) {
      // FALHOU ao enviar — limpar lock para permitir retry
      console.error('[auto-reply] Falha ao enviar:', sendErr instanceof Error ? sendErr.message : sendErr)
      await finalizeAutoReplyLock(lockId, false, finalMessage)
      return false
    }

    // 7. SUCESSO — marcar como enviado (agora sim, DEPOIS de enviar)
    await finalizeAutoReplyLock(lockId, true, finalMessage)

    // 8. Salvar mensagem no banco (non-critical — erro não muda o resultado)
    try {
      if (result?.key?.id) {
        const conversation = await prisma.conversation.findUnique({
          where: { tenantId_remoteJid: { tenantId, remoteJid } },
          select: { id: true },
        })
        if (conversation) {
          await prisma.message.create({
            data: {
              conversationId: conversation.id,
              tenantId,
              waMessageId: result.key.id,
              fromMe: true,
              type: 'TEXT',
              content: finalMessage,
              status: 'SENT',
            },
          })
        }
      }
    } catch (saveErr) {
      console.error('[auto-reply] Enviado com sucesso, mas falha ao salvar no banco:', saveErr instanceof Error ? saveErr.message : saveErr)
    }

    return true
  } catch (err) {
    console.error('[auto-reply] Erro inesperado:', err instanceof Error ? err.message : err)
    return false
  }
}
