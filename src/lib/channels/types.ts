// src/lib/channels/types.ts — Abstração unificada de canais de comunicação
// Cada canal (WhatsApp, Instagram, Facebook, Telegram, Email) implementa esta interface.

export type ChannelType = 'whatsapp' | 'instagram' | 'facebook' | 'telegram' | 'email'

export interface SendMessageParams {
  /** ID da instância/conexão no canal (ex: instanceId do Evolution API) */
  instanceId: string
  /** Identificador remoto do contato (ex: remoteJid no WhatsApp, PSID no Facebook) */
  remoteId: string
  /** Texto da mensagem */
  text: string
}

export interface SendMessageResult {
  /** ID da mensagem gerado pelo provedor */
  messageId: string
  /** Status da entrega */
  status: 'SENT' | 'FAILED'
}

export interface ChannelStatus {
  /** Se o canal está conectado */
  connected: boolean
  /** Estado detalhado (ex: 'open', 'connecting', 'close') */
  state: string
  /** Nome da instância/conta */
  name?: string
}

export interface IncomingMessage {
  /** ID único da mensagem no provedor */
  externalMessageId: string
  /** Se foi enviada por nós */
  fromMe: boolean
  /** Identificador remoto do contato */
  remoteId: string
  /** Nome do remetente (push name) */
  senderName?: string
  /** Tipo de conteúdo */
  type: 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'DOCUMENT'
  /** Conteúdo textual */
  content: string
  /** MIME type para mídia */
  mediaMimeType?: string
  /** URL da mídia */
  mediaUrl?: string
}

/**
 * Interface base para provedores de canal.
 * Cada canal implementa os métodos necessários para enviar/receber mensagens.
 */
export interface ChannelProvider {
  /** Tipo do canal */
  readonly type: ChannelType

  /** Nome exibido na UI */
  readonly displayName: string

  /** Cor de acento do canal (hex) */
  readonly accentColor: string

  /** Envia mensagem de texto */
  sendMessage(params: SendMessageParams): Promise<SendMessageResult>

  /** Verifica status da conexão */
  getStatus(instanceId: string): Promise<ChannelStatus>

  /** Conecta/reconecta o canal */
  connect(instanceId: string): Promise<{ success: boolean; data?: unknown }>

  /** Desconecta o canal */
  disconnect(instanceId: string): Promise<{ success: boolean }>

  /** Extrai dados de mensagem de um payload de webhook */
  parseWebhookPayload(payload: unknown): IncomingMessage | null
}

/** Mapa de ícone SVG path por canal — usado na UI */
export const CHANNEL_CONFIG: Record<ChannelType, {
  label: string
  color: string
  bgColor: string
  iconPath: string
}> = {
  whatsapp: {
    label: 'WhatsApp',
    color: '#25D366',
    bgColor: 'rgba(37,211,102,0.12)',
    iconPath: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z',
  },
  instagram: {
    label: 'Instagram',
    color: '#E4405F',
    bgColor: 'rgba(228,64,95,0.12)',
    iconPath: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z',
  },
  facebook: {
    label: 'Messenger',
    color: '#0084FF',
    bgColor: 'rgba(0,132,255,0.12)',
    iconPath: 'M12 0C5.373 0 0 4.975 0 11.111c0 3.497 1.745 6.616 4.472 8.652V24l4.086-2.242c1.09.301 2.246.464 3.442.464 6.627 0 12-4.974 12-11.111C24 4.975 18.627 0 12 0zm1.193 14.963l-3.056-3.259-5.963 3.259L10.732 8.1l3.131 3.259L19.752 8.1l-6.559 6.863z',
  },
  telegram: {
    label: 'Telegram',
    color: '#229ED9',
    bgColor: 'rgba(34,158,217,0.12)',
    iconPath: 'M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z',
  },
  email: {
    label: 'Email',
    color: '#7C6AEF',
    bgColor: 'rgba(124,106,239,0.12)',
    iconPath: 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6',
  },
}

/** Lista ordenada dos canais disponíveis */
export const CHANNEL_TYPES: ChannelType[] = ['whatsapp', 'instagram', 'facebook', 'telegram', 'email']
