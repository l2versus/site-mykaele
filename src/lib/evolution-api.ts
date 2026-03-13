// src/lib/evolution-api.ts — Cliente HTTP para Evolution API v2

interface FetchMessagesResult {
  messages: Array<{
    key: { id: string; fromMe: boolean; remoteJid: string }
    message: unknown
  }>
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
 * Normaliza remoteJid para número puro.
 * Evolution API v2 aceita JID ou número, mas algumas versões
 * falham com sufixos como @s.whatsapp.net. Removemos por segurança.
 */
function normalizeNumber(remoteJid: string): string {
  return remoteJid
    .replace(/@s\.whatsapp\.net$/, '')
    .replace(/@c\.us$/, '')
    .replace(/\D/g, '')
}

export const evolutionApi = {
  /** Envia mensagem de texto */
  sendText: (instanceId: string, remoteJid: string, text: string) =>
    request<{ key: { id: string } }>('POST', `/message/sendText/${instanceId}`, {
      number: normalizeNumber(remoteJid),
      text,
      delay: 1200,
    }, 8_000),

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
}
