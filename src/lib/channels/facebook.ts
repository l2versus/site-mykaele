// src/lib/channels/facebook.ts — Facebook Messenger provider via Meta Graph API
// Recebe e envia mensagens do Messenger usando a API oficial do Meta.
// Compartilha infraestrutura com Instagram (mesma Graph API, app diferente ou mesmo).

import type { ChannelProvider, SendMessageParams, SendMessageResult, ChannelStatus, IncomingMessage } from './types'
import { verifyMetaWebhookSignature } from './instagram'

const GRAPH_API = 'https://graph.facebook.com/v21.0'

interface MetaApiResponse {
  recipient_id?: string
  message_id?: string
  error?: { message: string; type: string; code: number }
}

interface MessengerWebhookEntry {
  id: string
  time: number
  messaging?: Array<{
    sender: { id: string }
    recipient: { id: string }
    timestamp: number
    message?: {
      mid: string
      text?: string
      attachments?: Array<{
        type: 'image' | 'video' | 'audio' | 'file' | 'template' | 'fallback'
        payload: { url?: string }
      }>
      is_echo?: boolean
      quick_reply?: { payload: string }
    }
  }>
}

async function graphRequest<T>(
  path: string,
  method: string,
  accessToken: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${GRAPH_API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10_000),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Facebook API ${res.status}: ${text.slice(0, 300)}`)
  }

  return res.json()
}

export const facebookProvider: ChannelProvider = {
  type: 'facebook',
  displayName: 'Messenger',
  accentColor: '#0084FF',

  async sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
    const accessToken = params.instanceId

    const result = await graphRequest<MetaApiResponse>(
      '/me/messages',
      'POST',
      accessToken,
      {
        recipient: { id: params.remoteId },
        message: { text: params.text },
        messaging_type: 'RESPONSE',
      },
    )

    if (result.error) {
      throw new Error(`Messenger API error: ${result.error.message}`)
    }

    return {
      messageId: result.message_id ?? `fb-${Date.now()}`,
      status: 'SENT',
    }
  },

  async getStatus(instanceId: string): Promise<ChannelStatus> {
    try {
      const result = await graphRequest<{ id: string; name?: string }>(
        '/me?fields=id,name',
        'GET',
        instanceId,
      )
      return {
        connected: !!result.id,
        state: 'open',
        name: result.name,
      }
    } catch {
      return { connected: false, state: 'error' }
    }
  },

  async connect(_instanceId: string): Promise<{ success: boolean; data?: unknown }> {
    return { success: true, data: { message: 'Use OAuth flow — mesma autenticação Meta do Instagram' } }
  },

  async disconnect(_instanceId: string): Promise<{ success: boolean }> {
    return { success: true }
  },

  parseWebhookPayload(payload: unknown): IncomingMessage | null {
    const entry = payload as MessengerWebhookEntry
    if (!entry?.messaging?.length) return null

    const msg = entry.messaging[0]
    if (!msg.message) return null

    let type: 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'DOCUMENT' = 'TEXT'
    let content = msg.message.text ?? ''
    let mediaUrl: string | undefined
    let mediaMimeType: string | undefined

    if (msg.message.attachments?.length) {
      const att = msg.message.attachments[0]
      mediaUrl = att.payload?.url
      switch (att.type) {
        case 'image':
          type = 'IMAGE'
          content = content || '[Imagem]'
          mediaMimeType = 'image/jpeg'
          break
        case 'video':
          type = 'VIDEO'
          content = content || '[Vídeo]'
          mediaMimeType = 'video/mp4'
          break
        case 'audio':
          type = 'AUDIO'
          content = content || '[Áudio]'
          mediaMimeType = 'audio/mpeg'
          break
        case 'file':
          type = 'DOCUMENT'
          content = content || '[Arquivo]'
          break
        default:
          break
      }
    }

    // Quick replies viram texto
    if (msg.message.quick_reply) {
      content = msg.message.quick_reply.payload
    }

    return {
      externalMessageId: msg.message.mid,
      fromMe: msg.message.is_echo ?? false,
      remoteId: msg.sender.id,
      type,
      content,
      mediaUrl,
      mediaMimeType,
    }
  },
}

/**
 * Envia mensagem de texto via Facebook Messenger.
 */
export async function sendFacebookMessage(
  accessToken: string,
  recipientId: string,
  text: string,
): Promise<{ messageId: string }> {
  const result = await graphRequest<MetaApiResponse>(
    '/me/messages',
    'POST',
    accessToken,
    {
      recipient: { id: recipientId },
      message: { text },
      messaging_type: 'RESPONSE',
    },
  )

  if (result.error) {
    throw new Error(`Messenger send error: ${result.error.message}`)
  }

  return { messageId: result.message_id ?? `fb-${Date.now()}` }
}

/**
 * Envia mensagem com botões rápidos via Messenger.
 */
export async function sendFacebookQuickReplies(
  accessToken: string,
  recipientId: string,
  text: string,
  quickReplies: Array<{ title: string; payload: string }>,
): Promise<{ messageId: string }> {
  const result = await graphRequest<MetaApiResponse>(
    '/me/messages',
    'POST',
    accessToken,
    {
      recipient: { id: recipientId },
      message: {
        text,
        quick_replies: quickReplies.map(qr => ({
          content_type: 'text',
          title: qr.title,
          payload: qr.payload,
        })),
      },
      messaging_type: 'RESPONSE',
    },
  )

  return { messageId: result.message_id ?? `fb-qr-${Date.now()}` }
}

// Re-exportar verificação de assinatura do Instagram (mesmo mecanismo Meta)
export { verifyMetaWebhookSignature }
