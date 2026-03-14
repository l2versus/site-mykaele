// src/lib/evolution-api.ts — Cliente HTTP para Evolution API v2

interface FetchMessagesResult {
  messages: Array<{
    key: { id: string; fromMe: boolean; remoteJid: string }
    message: unknown
  }>
}

export interface EvolutionMessage {
  key: { id: string; fromMe: boolean; remoteJid: string }
  pushName?: string
  messageTimestamp?: number
  message?: {
    conversation?: string
    extendedTextMessage?: { text?: string }
    imageMessage?: { mimetype?: string; url?: string; caption?: string }
    audioMessage?: { mimetype?: string; url?: string }
    videoMessage?: { mimetype?: string; url?: string; caption?: string }
    documentMessage?: { mimetype?: string; url?: string; fileName?: string }
  }
}

interface InstanceStatusResult {
  instance: {
    instanceName: string
    state: string
  }
}

async function request<T>(method: string, path: string, body?: unknown, timeoutMs = 8_000): Promise<T> {
  const baseUrl = process.env.EVOLUTION_API_URL
  if (!baseUrl) throw new Error('EVOLUTION_API_URL não configurada')

  const apiKey = process.env.EVOLUTION_API_KEY
  if (!apiKey) throw new Error('EVOLUTION_API_KEY não configurada')

  // Normalizar URL base (remover barra final se houver)
  const normalizedBase = baseUrl.replace(/\/+$/, '')

  const url = `${normalizedBase}${path}`
  let res: Response
  try {
    res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('AbortError') || msg.includes('timeout') || msg.includes('abort')) {
      throw new Error(`Evolution API timeout (${timeoutMs}ms) em ${method} ${path}. URL: ${normalizedBase}`)
    }
    throw new Error(`Evolution API inalcançável em ${method} ${path}. URL: ${normalizedBase}. Erro: ${msg}`)
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Evolution API ${res.status} ${method} ${path}: ${text.slice(0, 300)}`)
  }

  return res.json()
}

/**
 * Normaliza remoteJid para número puro com código do país.
 * Evolution API v2 exige número no formato internacional (ex: 5585998500344).
 * Números brasileiros sem o prefixo 55 recebem o código automaticamente.
 *
 * JIDs no formato @lid (Linked ID do WhatsApp) são mantidos intactos,
 * pois não são números de telefone — a Evolution API resolve internamente.
 */
function normalizeNumber(remoteJid: string): string {
  // LID (Linked ID) — manter JID completo para Evolution API resolver
  if (remoteJid.endsWith('@lid')) {
    return remoteJid
  }

  const digits = remoteJid
    .replace(/@s\.whatsapp\.net$/, '')
    .replace(/@c\.us$/, '')
    .replace(/\D/g, '')

  // Número brasileiro sem código do país (10-11 dígitos: DDD + número)
  // 10 dígitos = fixo/celular antigo, 11 dígitos = celular com 9
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`
  }

  return digits
}

export const evolutionApi = {
  /** Envia mensagem de texto — suporta @s.whatsapp.net e @lid (Linked ID) */
  sendText: (instanceId: string, remoteJid: string, text: string) =>
    request<{ key: { id: string } }>('POST', `/message/sendText/${instanceId}`, {
      number: normalizeNumber(remoteJid),
      text,
      textMessage: { text },
      delay: 1200,
    }, 12_000),

  /** Envia template (HSM) */
  sendTemplate: (instanceId: string, remoteJid: string, template: string, variables: string[]) =>
    request<{ key: { id: string } }>('POST', `/message/sendTemplate/${instanceId}`, {
      number: normalizeNumber(remoteJid),
      name: template,
      language: { code: 'pt_BR' },
      components: [{
        type: 'body',
        parameters: variables.map(v => ({ type: 'text', text: v })),
      }],
    }, 8_000),

  /** Busca mensagens recentes de uma instância */
  fetchMessages: (instanceId: string, count = 50) =>
    request<FetchMessagesResult>('GET', `/chat/fetchMessages/${instanceId}?count=${count}`),

  /** Marca mensagens como lidas */
  markRead: (instanceId: string, messageIds: string[]) =>
    request<void>('POST', `/message/markMessageAsRead/${instanceId}`, {
      read_messages: messageIds.map(id => ({ id, fromMe: false, remote: '' })),
    }),

  /** Verifica status da instância */
  getStatus: (instanceId: string) =>
    request<InstanceStatusResult>('GET', `/instance/connectionState/${instanceId}`, undefined, 6_000),

  /** Gera QR Code para conexão */
  getQrCode: (instanceId: string) =>
    request<{ base64: string; code: string }>('GET', `/instance/connect/${instanceId}`, undefined, 12_000),

  /** Cria nova instância */
  createInstance: (instanceName: string, webhookUrl: string) =>
    request<{ instance: { instanceName: string; instanceId: string } }>(
      'POST',
      '/instance/create',
      {
        instanceName,
        integration: 'WHATSAPP-BAILEYS',
        qrcode: true,
        webhook: webhookUrl,
      },
      10_000,
    ),

  /** Desconecta a instância (logout do WhatsApp) */
  logoutInstance: (instanceId: string) =>
    request<{ status: string }>('DELETE', `/instance/logout/${instanceId}`),

  /** Reinicia a instância para reconectar */
  restartInstance: (instanceId: string) =>
    request<{ status: string }>('PUT', `/instance/restart/${instanceId}`),

  /** Lista todas as instâncias */
  fetchInstances: () =>
    request<Array<{
      instance: { instanceName: string; instanceId: string; owner: string; status: string }
    }>>('GET', '/instance/fetchInstances', undefined, 10_000),

  /** Configura webhook na instância (obrigatório para receber mensagens) */
  setWebhook: (instanceName: string, webhookUrl: string) =>
    request<{ webhook: { url: string; events: string[] } }>(
      'POST',
      `/webhook/set/${instanceName}`,
      {
        url: webhookUrl,
        enabled: true,
        webhookByEvents: false,
        webhookBase64: false,
        events: [
          'MESSAGES_UPSERT',
          'MESSAGES_UPDATE',
          'CONNECTION_UPDATE',
        ],
      },
      8_000,
    ),

  /** Busca configuração atual do webhook */
  findWebhook: (instanceName: string) =>
    request<{ url?: string; events?: string[]; enabled?: boolean } | null>(
      'GET',
      `/webhook/find/${instanceName}`,
      undefined,
      6_000,
    ),

  /** Busca mensagens de um chat específico (para polling) */
  findMessages: (instanceName: string, remoteJid: string, limit = 20) =>
    request<{ messages?: EvolutionMessage[] } | EvolutionMessage[]>(
      'POST',
      `/chat/findMessages/${instanceName}`,
      { where: { key: { remoteJid } }, limit },
      6_000, // 6s timeout — evita travar o polling inteiro
    ),

  /** Lista todos os chats da instância */
  findChats: (instanceName: string) =>
    request<Array<{ id: string; remoteJid: string; name?: string; unreadCount?: number }>>(
      'GET',
      `/chat/findChats/${instanceName}`,
      undefined,
      10_000,
    ),
}
