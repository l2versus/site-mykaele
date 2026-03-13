// src/lib/auto-reply.ts — Auto-resposta para novos leads via WhatsApp
// Envia UMA vez por lead quando recebe a primeira mensagem.
// Config armazenada em CrmIntegration (provider: 'auto-reply').
// Rastreio via LeadActivity (type: 'AUTO_REPLY_SENT').

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

/**
 * Busca config de auto-reply do tenant.
 * Retorna null se não existir ou estiver desabilitada.
 */
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

/**
 * Verifica se já enviou auto-reply para este lead.
 */
async function alreadySentAutoReply(leadId: string): Promise<boolean> {
  const activity = await prisma.leadActivity.findFirst({
    where: { leadId, type: 'AUTO_REPLY_SENT' },
    select: { id: true },
  })
  return !!activity
}

/**
 * Registra que o auto-reply foi enviado para este lead.
 */
async function markAutoReplySent(leadId: string, message: string): Promise<void> {
  await prisma.leadActivity.create({
    data: {
      leadId,
      type: 'AUTO_REPLY_SENT',
      payload: { message, sentAt: new Date().toISOString() },
    },
  })
}

/**
 * Substitui variáveis na mensagem de auto-reply.
 * Suporta: {{nome}} — primeiro nome do lead
 */
function interpolateMessage(template: string, leadName: string): string {
  const firstName = leadName.split(' ')[0] || 'cliente'
  return template.replace(/\{\{nome\}\}/gi, firstName)
}

/**
 * Tenta enviar auto-reply para um lead que acabou de enviar mensagem.
 * Chamado APÓS a mensagem ser salva no banco (non-blocking, fire-and-forget).
 *
 * Condições:
 * 1. Auto-reply habilitado no tenant
 * 2. Mensagem NÃO é fromMe
 * 3. Lead nunca recebeu auto-reply antes
 * 4. Canal tem instanceId válido
 */
export async function tryAutoReply(params: {
  tenantId: string
  leadId: string
  leadName: string
  channelId: string
  remoteJid: string
  fromMe: boolean
}): Promise<void> {
  const { tenantId, leadId, leadName, channelId, remoteJid, fromMe } = params

  // Só responde mensagens recebidas (não as que enviamos)
  if (fromMe) return

  try {
    // 1. Buscar config
    const config = await getAutoReplyConfig(tenantId)
    if (!config) return

    // 2. Verificar se já enviou para este lead
    const alreadySent = await alreadySentAutoReply(leadId)
    if (alreadySent) return

    // 3. Buscar instanceId do canal
    const channel = await prisma.crmChannel.findUnique({
      where: { id: channelId },
      select: { instanceId: true },
    })
    if (!channel?.instanceId) return

    // 4. Interpolar mensagem
    const finalMessage = interpolateMessage(config.message, leadName)

    // 5. Delay para parecer humano (3-5s)
    await new Promise(resolve => setTimeout(resolve, config.delayMs))

    // 6. Enviar via Evolution API
    const result = await evolutionApi.sendText(channel.instanceId, remoteJid, finalMessage)

    // 7. Salvar mensagem enviada no banco
    if (result?.key?.id) {
      // Buscar conversa para vincular a mensagem
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

    // 8. Marcar como enviado (nunca mais envia para este lead)
    await markAutoReplySent(leadId, finalMessage)
  } catch (err) {
    // Non-blocking — não deve quebrar o fluxo principal
    console.error('[auto-reply] Erro ao enviar auto-reply:', err instanceof Error ? err.message : err)
  }
}
