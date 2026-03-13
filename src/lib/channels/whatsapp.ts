// src/lib/channels/whatsapp.ts — WhatsApp provider via Evolution API
// Implementa a interface ChannelProvider para o canal WhatsApp existente.

import { evolutionApi } from '@/lib/evolution-api'
import type { ChannelProvider, SendMessageParams, SendMessageResult, ChannelStatus, IncomingMessage } from './types'

interface EvolutionWebhookPayload {
  event: string
  instance: string
  data: {
    key?: { id: string; fromMe: boolean; remoteJid: string }
    message?: {
      conversation?: string
      extendedTextMessage?: { text: string }
      imageMessage?: { mimetype: string; url: string; caption?: string }
      audioMessage?: { mimetype: string; url: string }
      videoMessage?: { mimetype: string; url: string; caption?: string }
      documentMessage?: { mimetype: string; url: string; fileName?: string }
    }
    pushName?: string
    status?: string
  }
}

function extractMessageContent(message: EvolutionWebhookPayload['data']['message']): {
  type: 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'DOCUMENT'
  content: string
  mediaMimeType?: string
  mediaUrl?: string
} {
  if (!message) return { type: 'TEXT', content: '' }

  if (message.imageMessage) {
    return {
      type: 'IMAGE',
      content: message.imageMessage.caption ?? '[Imagem]',
      mediaMimeType: message.imageMessage.mimetype,
      mediaUrl: message.imageMessage.url,
    }
  }
  if (message.audioMessage) {
    return {
      type: 'AUDIO',
      content: '[Áudio]',
      mediaMimeType: message.audioMessage.mimetype,
      mediaUrl: message.audioMessage.url,
    }
  }
  if (message.videoMessage) {
    return {
      type: 'VIDEO',
      content: message.videoMessage.caption ?? '[Vídeo]',
      mediaMimeType: message.videoMessage.mimetype,
      mediaUrl: message.videoMessage.url,
    }
  }
  if (message.documentMessage) {
    return {
      type: 'DOCUMENT',
      content: message.documentMessage.fileName ?? '[Documento]',
      mediaMimeType: message.documentMessage.mimetype,
      mediaUrl: message.documentMessage.url,
    }
  }

  const text = message.conversation ?? message.extendedTextMessage?.text ?? ''
  return { type: 'TEXT', content: text }
}

export const whatsappProvider: ChannelProvider = {
  type: 'whatsapp',
  displayName: 'WhatsApp',
  accentColor: '#25D366',

  async sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
    const result = await evolutionApi.sendText(
      params.instanceId,
      params.remoteId,
      params.text,
    )
    return {
      messageId: result.key.id,
      status: 'SENT',
    }
  },

  async getStatus(instanceId: string): Promise<ChannelStatus> {
    try {
      const result = await evolutionApi.getStatus(instanceId)
      return {
        connected: result.instance.state === 'open',
        state: result.instance.state,
        name: result.instance.instanceName,
      }
    } catch {
      return { connected: false, state: 'error' }
    }
  },

  async connect(instanceId: string): Promise<{ success: boolean; data?: unknown }> {
    try {
      const qr = await evolutionApi.getQrCode(instanceId)
      return { success: true, data: qr }
    } catch {
      return { success: false }
    }
  },

  async disconnect(instanceId: string): Promise<{ success: boolean }> {
    try {
      await evolutionApi.logoutInstance(instanceId)
      return { success: true }
    } catch {
      return { success: false }
    }
  },

  parseWebhookPayload(payload: unknown): IncomingMessage | null {
    const data = payload as EvolutionWebhookPayload
    if (!data?.data?.key) return null

    const { key, message, pushName } = data.data
    const extracted = extractMessageContent(message)

    return {
      externalMessageId: key.id,
      fromMe: key.fromMe,
      remoteId: key.remoteJid,
      senderName: pushName,
      type: extracted.type,
      content: extracted.content,
      mediaMimeType: extracted.mediaMimeType,
      mediaUrl: extracted.mediaUrl,
    }
  },
}
