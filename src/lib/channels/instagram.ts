// src/lib/channels/instagram.ts — Instagram DM provider via Meta Graph API
// Recebe e envia DMs do Instagram Business usando a API oficial do Meta.

import type { ChannelProvider, SendMessageParams, SendMessageResult, ChannelStatus, IncomingMessage } from './types'

const GRAPH_API = 'https://graph.facebook.com/v21.0'

interface MetaApiResponse {
  recipient_id?: string
  message_id?: string
  error?: { message: string; type: string; code: number }
}

interface InstagramWebhookEntry {
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
        type: 'image' | 'video' | 'audio' | 'file'
        payload: { url: string }
      }>
      is_echo?: boolean
    }
  }>
}

async function graphRequest<T>(
  path: string,
  method: string,
  accessToken: string,
  body?: unknown,
): Promise<T> {
  const url = `${GRAPH_API}${path}`
  const res = await fetch(url, {
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
    throw new Error(`Instagram API ${res.status}: ${text.slice(0, 300)}`)
  }

  return res.json()
}

export const instagramProvider: ChannelProvider = {
  type: 'instagram',
  displayName: 'Instagram',
  accentColor: '#E4405F',

  async sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
    // instanceId = Instagram Page ID, remoteId = IGSID (Instagram-scoped ID)
    // accessToken deve estar armazenado nas credenciais do CrmChannel
    const accessToken = params.instanceId // será substituído pela credencial real no wrapper

    const result = await graphRequest<MetaApiResponse>(
      `/me/messages`,
      'POST',
      accessToken,
      {
        recipient: { id: params.remoteId },
        message: { text: params.text },
      },
    )

    if (result.error) {
      throw new Error(`Instagram API error: ${result.error.message}`)
    }

    return {
      messageId: result.message_id ?? `ig-${Date.now()}`,
      status: 'SENT',
    }
  },

  async getStatus(instanceId: string): Promise<ChannelStatus> {
    try {
      // Verificar se o token é válido fazendo um request simples
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
    // O fluxo de conexão do Instagram é via OAuth — tratado na rota /api/admin/crm/channels/instagram/connect
    return { success: true, data: { message: 'Use OAuth flow via /api/admin/crm/channels/instagram/connect' } }
  },

  async disconnect(_instanceId: string): Promise<{ success: boolean }> {
    // Revogar acesso requer uma chamada à Graph API
    return { success: true }
  },

  parseWebhookPayload(payload: unknown): IncomingMessage | null {
    const entry = payload as InstagramWebhookEntry
    if (!entry?.messaging?.length) return null

    const msg = entry.messaging[0]
    if (!msg.message) return null

    // Determinar tipo de conteúdo
    let type: 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'DOCUMENT' = 'TEXT'
    let content = msg.message.text ?? ''
    let mediaUrl: string | undefined
    let mediaMimeType: string | undefined

    if (msg.message.attachments?.length) {
      const attachment = msg.message.attachments[0]
      mediaUrl = attachment.payload.url
      switch (attachment.type) {
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
      }
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
 * Envia mensagem de texto via Instagram DM.
 * accessToken: token de longa duração do Page Access Token
 * recipientId: IGSID do destinatário
 */
export async function sendInstagramMessage(
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
    },
  )

  if (result.error) {
    throw new Error(`Instagram send error: ${result.error.message}`)
  }

  return { messageId: result.message_id ?? `ig-${Date.now()}` }
}

/**
 * Envia imagem via Instagram DM.
 */
export async function sendInstagramImage(
  accessToken: string,
  recipientId: string,
  imageUrl: string,
): Promise<{ messageId: string }> {
  const result = await graphRequest<MetaApiResponse>(
    '/me/messages',
    'POST',
    accessToken,
    {
      recipient: { id: recipientId },
      message: {
        attachment: {
          type: 'image',
          payload: { url: imageUrl, is_reusable: true },
        },
      },
    },
  )

  return { messageId: result.message_id ?? `ig-img-${Date.now()}` }
}

/**
 * Verifica assinatura do webhook do Meta (Instagram/Facebook).
 * Usa HMAC-SHA256 com o App Secret.
 */
export function verifyMetaWebhookSignature(
  signature: string,
  body: string,
  appSecret: string,
): boolean {
  const crypto = require('crypto') as typeof import('crypto')
  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', appSecret)
    .update(body)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature),
  )
}
