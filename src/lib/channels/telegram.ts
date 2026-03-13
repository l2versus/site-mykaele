// src/lib/channels/telegram.ts — Telegram Bot provider via Bot API
// Envia e recebe mensagens usando o Telegram Bot API.

import type { ChannelProvider, SendMessageParams, SendMessageResult, ChannelStatus, IncomingMessage } from './types'

const TELEGRAM_API = 'https://api.telegram.org'

interface TelegramResponse<T> {
  ok: boolean
  result?: T
  description?: string
}

interface TelegramMessage {
  message_id: number
  from?: { id: number; first_name: string; last_name?: string; username?: string }
  chat: { id: number; type: string; first_name?: string; last_name?: string; username?: string }
  date: number
  text?: string
  photo?: Array<{ file_id: string; width: number; height: number }>
  document?: { file_id: string; file_name?: string; mime_type?: string }
  audio?: { file_id: string; duration: number; mime_type?: string }
  video?: { file_id: string; duration: number; mime_type?: string }
  voice?: { file_id: string; duration: number; mime_type?: string }
}

interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
}

async function botRequest<T>(
  botToken: string,
  method: string,
  body?: unknown,
): Promise<T> {
  const url = `${TELEGRAM_API}/bot${botToken}/${method}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10_000),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Telegram API ${res.status}: ${text.slice(0, 300)}`)
  }

  const data: TelegramResponse<T> = await res.json()
  if (!data.ok) {
    throw new Error(`Telegram API error: ${data.description}`)
  }

  return data.result as T
}

export const telegramProvider: ChannelProvider = {
  type: 'telegram',
  displayName: 'Telegram',
  accentColor: '#229ED9',

  async sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
    const result = await botRequest<TelegramMessage>(
      params.instanceId, // botToken
      'sendMessage',
      {
        chat_id: params.remoteId,
        text: params.text,
        parse_mode: 'HTML',
      },
    )

    return {
      messageId: `tg-${result.message_id}`,
      status: 'SENT',
    }
  },

  async getStatus(instanceId: string): Promise<ChannelStatus> {
    try {
      const me = await botRequest<{ id: number; first_name: string; username: string }>(
        instanceId,
        'getMe',
      )
      return {
        connected: true,
        state: 'open',
        name: `@${me.username}`,
      }
    } catch {
      return { connected: false, state: 'error' }
    }
  },

  async connect(instanceId: string): Promise<{ success: boolean; data?: unknown }> {
    try {
      const me = await botRequest<{ id: number; first_name: string; username: string }>(
        instanceId,
        'getMe',
      )
      return { success: true, data: me }
    } catch {
      return { success: false }
    }
  },

  async disconnect(_instanceId: string): Promise<{ success: boolean }> {
    // Remover webhook ao desconectar
    try {
      await botRequest(_instanceId, 'deleteWebhook')
      return { success: true }
    } catch {
      return { success: false }
    }
  },

  parseWebhookPayload(payload: unknown): IncomingMessage | null {
    const update = payload as TelegramUpdate
    const msg = update?.message
    if (!msg) return null

    let type: 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'DOCUMENT' = 'TEXT'
    let content = msg.text ?? ''
    let mediaMimeType: string | undefined
    let mediaUrl: string | undefined // URLs precisam ser resolvidas via getFile

    if (msg.photo?.length) {
      type = 'IMAGE'
      content = content || '[Foto]'
      mediaMimeType = 'image/jpeg'
      // file_id da maior resolução
      mediaUrl = `tg-file:${msg.photo[msg.photo.length - 1].file_id}`
    } else if (msg.document) {
      type = 'DOCUMENT'
      content = msg.document.file_name ?? '[Documento]'
      mediaMimeType = msg.document.mime_type
      mediaUrl = `tg-file:${msg.document.file_id}`
    } else if (msg.audio) {
      type = 'AUDIO'
      content = '[Áudio]'
      mediaMimeType = msg.audio.mime_type
      mediaUrl = `tg-file:${msg.audio.file_id}`
    } else if (msg.video) {
      type = 'VIDEO'
      content = '[Vídeo]'
      mediaMimeType = msg.video.mime_type
      mediaUrl = `tg-file:${msg.video.file_id}`
    } else if (msg.voice) {
      type = 'AUDIO'
      content = '[Áudio]'
      mediaMimeType = msg.voice.mime_type ?? 'audio/ogg'
      mediaUrl = `tg-file:${msg.voice.file_id}`
    }

    const senderName = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(' ')

    return {
      externalMessageId: `tg-${msg.message_id}-${msg.chat.id}`,
      fromMe: false,
      remoteId: String(msg.chat.id),
      senderName: senderName || undefined,
      type,
      content,
      mediaMimeType,
      mediaUrl,
    }
  },
}

/**
 * Envia mensagem de texto via Telegram Bot API.
 */
export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
): Promise<{ messageId: string }> {
  const result = await botRequest<TelegramMessage>(
    botToken,
    'sendMessage',
    { chat_id: chatId, text, parse_mode: 'HTML' },
  )
  return { messageId: `tg-${result.message_id}` }
}

/**
 * Configura webhook do Telegram para apontar para nossa URL.
 */
export async function setTelegramWebhook(
  botToken: string,
  webhookUrl: string,
  secretToken?: string,
): Promise<boolean> {
  const result = await botRequest<boolean>(
    botToken,
    'setWebhook',
    {
      url: webhookUrl,
      allowed_updates: ['message'],
      secret_token: secretToken,
    },
  )
  return result
}

/**
 * Valida a identidade do bot e retorna informações.
 */
export async function getTelegramBotInfo(botToken: string): Promise<{
  id: number
  firstName: string
  username: string
}> {
  const me = await botRequest<{ id: number; first_name: string; username: string }>(
    botToken,
    'getMe',
  )
  return { id: me.id, firstName: me.first_name, username: me.username }
}
