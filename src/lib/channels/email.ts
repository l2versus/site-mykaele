// src/lib/channels/email.ts — Email channel provider via Resend
// Envia e recebe emails usando o Resend SDK.

import { Resend } from 'resend'
import type { ChannelProvider, SendMessageParams, SendMessageResult, ChannelStatus, IncomingMessage } from './types'

const FROM_EMAIL = 'Mykaele Procópio <contato@mykaprocopio.com.br>'
const FALLBACK_FROM = 'onboarding@resend.dev'

let resendInstance: Resend | null = null
function getResend(apiKey?: string): Resend {
  const key = apiKey || process.env.RESEND_API_KEY
  if (!resendInstance || apiKey) {
    resendInstance = new Resend(key)
  }
  return resendInstance
}

export const emailProvider: ChannelProvider = {
  type: 'email',
  displayName: 'Email',
  accentColor: '#7C6AEF',

  async sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
    const from = process.env.RESEND_VERIFIED_DOMAIN ? FROM_EMAIL : FALLBACK_FROM
    const resend = getResend(params.instanceId || undefined)

    const { data, error } = await resend.emails.send({
      from,
      to: params.remoteId,
      subject: 'Nova mensagem — Clínica Mykaele Procópio',
      html: formatEmailHtml(params.text),
      text: params.text,
    })

    if (error || !data?.id) {
      return { messageId: '', status: 'FAILED' }
    }

    return { messageId: `email-${data.id}`, status: 'SENT' }
  },

  async getStatus(instanceId: string): Promise<ChannelStatus> {
    try {
      const resend = getResend(instanceId || undefined)
      // Validar API key listando domínios
      await resend.domains.list()
      return { connected: true, state: 'open', name: 'Resend' }
    } catch {
      return { connected: false, state: 'error' }
    }
  },

  async connect(instanceId: string): Promise<{ success: boolean; data?: unknown }> {
    try {
      const resend = getResend(instanceId || undefined)
      const { data } = await resend.domains.list()
      return {
        success: true,
        data: {
          domains: data?.data?.map(d => ({
            name: d.name,
            status: d.status,
          })) ?? [],
        },
      }
    } catch {
      return { success: false }
    }
  },

  async disconnect(): Promise<{ success: boolean }> {
    return { success: true }
  },

  parseWebhookPayload(payload: unknown): IncomingMessage | null {
    const event = payload as ResendWebhookEvent
    if (!event?.type || !event?.data) return null

    // Apenas processar emails recebidos (inbound)
    if (event.type !== 'email.received') return null

    const data = event.data
    return {
      externalMessageId: `email-${data.email_id || data.message_id || Date.now()}`,
      fromMe: false,
      remoteId: data.from,
      senderName: data.from_name || data.from.split('@')[0],
      type: 'TEXT',
      content: data.text || data.html?.replace(/<[^>]*>/g, '').substring(0, 5000) || '[Email sem conteúdo]',
    }
  },
}

interface ResendWebhookEvent {
  type: string
  data: ResendInboundData
}

interface ResendInboundData {
  email_id?: string
  message_id?: string
  from: string
  from_name?: string
  to: string[]
  subject: string
  text?: string
  html?: string
}

/**
 * Envia email via Resend com conteúdo formatado.
 */
export async function sendCrmEmail(
  to: string,
  subject: string,
  text: string,
  apiKey?: string,
): Promise<{ messageId: string }> {
  const from = process.env.RESEND_VERIFIED_DOMAIN ? FROM_EMAIL : FALLBACK_FROM
  const resend = getResend(apiKey || undefined)

  const { data, error } = await resend.emails.send({
    from,
    to,
    subject,
    html: formatEmailHtml(text),
    text,
  })

  if (error || !data?.id) {
    throw new Error(error?.message || 'Falha ao enviar email')
  }

  return { messageId: `email-${data.id}` }
}

/**
 * Verifica assinatura HMAC-SHA256 do webhook Resend.
 */
export async function verifyResendWebhookSignature(
  body: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
  const expected = Array.from(new Uint8Array(signed))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  return expected === signature
}

/**
 * Formata texto como HTML de email com design premium.
 */
function formatEmailHtml(text: string): string {
  const lines = text.split('\n').map(l => `<p style="margin:0 0 8px 0;line-height:1.6">${l || '&nbsp;'}</p>`).join('')

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
        <tr>
          <td style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:24px 32px;text-align:center">
            <span style="font-family:Georgia,'Times New Roman',serif;font-size:20px;color:#D4AF37;letter-spacing:1px">Mykaele Procópio</span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;color:#333;font-size:15px">
            ${lines}
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 24px;border-top:1px solid #eee;text-align:center;color:#999;font-size:12px">
            Clínica Mykaele Procópio — Estética de Luxo
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
