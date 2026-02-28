/**
 * WhatsApp server-side notification utility
 *
 * Supports 3 methods (tried in order):
 * 1. Evolution API  — self-hosted, full control
 * 2. CallMeBot      — free, instant, zero setup cost
 * 3. Console log    — fallback when nothing is configured
 *
 * To enable CallMeBot (fastest setup):
 *   1. Salve o numero +34 644 71 91 45 nos contatos do celular
 *   2. Envie "I allow callmebot to send me messages" via WhatsApp para esse numero
 *   3. Voce vai receber um apikey
 *   4. Coloque o apikey no .env.local: CALLMEBOT_API_KEY=SUA_CHAVE
 */

const EVOLUTION_API_URL = process.env.WHATSAPP_API_URL || ''
const EVOLUTION_API_KEY = process.env.WHATSAPP_API_KEY || ''
const EVOLUTION_INSTANCE = process.env.WHATSAPP_INSTANCE_ID || ''

const CALLMEBOT_API_KEY = process.env.CALLMEBOT_API_KEY || ''
const CALLMEBOT_PHONE = process.env.CALLMEBOT_PHONE || '558599086924'

const PROFESSIONAL_NUMBER = '5585999086924'

// ───────── Helpers ─────────

function hasEvolutionApi(): boolean {
  return !!(
    EVOLUTION_API_URL &&
    EVOLUTION_API_KEY &&
    EVOLUTION_INSTANCE &&
    !EVOLUTION_API_KEY.includes('sua-chave')
  )
}

function hasCallMeBot(): boolean {
  return !!CALLMEBOT_API_KEY && !CALLMEBOT_API_KEY.includes('sua-chave')
}

// ───────── Evolution API ─────────

async function sendViaEvolution(to: string, message: string): Promise<boolean> {
  try {
    const res = await fetch(`${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_API_KEY },
      body: JSON.stringify({ number: to, text: message }),
    })
    if (!res.ok) {
      console.error('[WhatsApp][Evolution] Error:', res.status, await res.text())
      return false
    }
    console.log('[WhatsApp][Evolution] Sent OK')
    return true
  } catch (err) {
    console.error('[WhatsApp][Evolution] Fetch error:', err)
    return false
  }
}

// ───────── CallMeBot (free) ─────────

async function sendViaCallMeBot(message: string): Promise<boolean> {
  try {
    const url = `https://api.callmebot.com/whatsapp.php?phone=${CALLMEBOT_PHONE}&text=${encodeURIComponent(message)}&apikey=${CALLMEBOT_API_KEY}`
    const res = await fetch(url)
    const body = await res.text()
    if (body.includes('APIKey is invalid') || body.includes('not activated')) {
      console.error('[WhatsApp][CallMeBot] Auth error:', body)
      return false
    }
    console.log('[WhatsApp][CallMeBot] Sent OK')
    return true
  } catch (err) {
    console.error('[WhatsApp][CallMeBot] Fetch error:', err)
    return false
  }
}

// ───────── Public API ─────────

export async function sendBookingNotification(data: {
  clientName: string
  clientPhone?: string | null
  serviceName: string
  date: string
  time: string
  location: string
  address?: string | null
  type: string
  price: number
  packageInfo?: {
    packageName: string
    sessionsUsed: number
    sessionsTotal: number
    sessionsRemaining: number
  } | null
}): Promise<{ sent: boolean; method: string }> {
  const lines: string[] = [
    '*NOVO AGENDAMENTO*',
    '',
    `*Cliente:* ${data.clientName}`,
  ]
  if (data.clientPhone) lines.push(`*Telefone:* ${data.clientPhone}`)
  lines.push(`*Servico:* ${data.serviceName}`)
  lines.push(`*Data:* ${data.date}`)
  lines.push(`*Horario:* ${data.time}`)
  lines.push(`*Local:* ${data.location}`)
  if (data.address) lines.push(`*Endereco:* ${data.address}`)
  lines.push(`*Tipo:* ${data.type}`)
  lines.push(`*Valor:* R$ ${data.price.toFixed(2).replace('.', ',')}`)
  if (data.packageInfo) {
    lines.push('')
    lines.push(`*Pacote:* ${data.packageInfo.packageName}`)
    lines.push(`*Sessoes:* ${data.packageInfo.sessionsUsed}/${data.packageInfo.sessionsTotal} realizadas`)
    lines.push(`*Faltam:* ${data.packageInfo.sessionsRemaining} sessoes`)
  }
  const message = lines.join('\n')

  // 1. Try Evolution API
  if (hasEvolutionApi()) {
    const ok = await sendViaEvolution(PROFESSIONAL_NUMBER, message)
    if (ok) return { sent: true, method: 'evolution-api' }
  }

  // 2. Try CallMeBot (free)
  if (hasCallMeBot()) {
    const ok = await sendViaCallMeBot(message)
    if (ok) return { sent: true, method: 'callmebot' }
  }

  // 3. Fallback: log
  console.log('[WhatsApp] Nenhuma API configurada. Configure CALLMEBOT_API_KEY ou Evolution API no .env.local')
  console.log('[WhatsApp] Mensagem que seria enviada para', PROFESSIONAL_NUMBER, ':\n', message)

  return { sent: false, method: 'logged' }
}

export async function sendPackageNotification(data: {
  clientName: string
  clientPhone?: string | null
  serviceName: string
  packageName: string
  totalSessions: number
  sessions: { date: string; time: string }[]
}): Promise<{ sent: boolean; method: string }> {
  const lines: string[] = [
    '*NOVO PACOTE AGENDADO*',
    '',
    `*Cliente:* ${data.clientName}`,
  ]
  if (data.clientPhone) lines.push(`*Telefone:* ${data.clientPhone}`)
  lines.push(`*Servico:* ${data.serviceName}`)
  lines.push(`*Pacote:* ${data.packageName}`)
  lines.push(`*Sessoes:* ${data.totalSessions}`)
  lines.push('')
  lines.push('*Datas agendadas:*')
  data.sessions.forEach((s, i) => {
    lines.push(`  ${i + 1}. ${s.date} as ${s.time}`)
  })
  const message = lines.join('\n')

  if (hasEvolutionApi()) {
    const ok = await sendViaEvolution(PROFESSIONAL_NUMBER, message)
    if (ok) return { sent: true, method: 'evolution-api' }
  }
  if (hasCallMeBot()) {
    const ok = await sendViaCallMeBot(message)
    if (ok) return { sent: true, method: 'callmebot' }
  }

  console.log('[WhatsApp] Nenhuma API configurada. Mensagem logada:\n', message)
  return { sent: false, method: 'logged' }
}

export async function sendPurchaseNotification(data: {
  clientName: string
  clientPhone?: string | null
  clientEmail?: string | null
  items: Array<{ name: string; sessions: number; price: number }>
  totalAmount: number
  paymentMethod: string
  paymentId?: string | null
  transactionDate: string
}): Promise<{ sent: boolean; method: string }> {
  const fmtBRL = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`
  const lines: string[] = [
    '💰 *NOVA COMPRA DE CRÉDITOS*',
    '',
    `👤 *Cliente:* ${data.clientName}`,
  ]
  if (data.clientPhone) lines.push(`📱 *Telefone:* ${data.clientPhone}`)
  if (data.clientEmail) lines.push(`📧 *Email:* ${data.clientEmail}`)
  lines.push('')
  lines.push('📋 *Itens comprados:*')
  data.items.forEach((item, i) => {
    lines.push(`  ${i + 1}. ${item.name}`)
    lines.push(`     ${item.sessions} sessão(ões) — ${fmtBRL(item.price)}`)
  })
  lines.push('')
  lines.push(`💳 *Forma de pagamento:* ${data.paymentMethod}`)
  lines.push(`💵 *Valor total:* ${fmtBRL(data.totalAmount)}`)
  if (data.paymentId) lines.push(`🔑 *ID transação:* ${data.paymentId}`)
  lines.push(`📅 *Data:* ${data.transactionDate}`)
  lines.push('')
  lines.push('✅ Pagamento confirmado com sucesso!')
  const message = lines.join('\n')

  if (hasEvolutionApi()) {
    const ok = await sendViaEvolution(PROFESSIONAL_NUMBER, message)
    if (ok) return { sent: true, method: 'evolution-api' }
  }
  if (hasCallMeBot()) {
    const ok = await sendViaCallMeBot(message)
    if (ok) return { sent: true, method: 'callmebot' }
  }

  console.log('[WhatsApp] Compra de créditos logada:\n', message)
  return { sent: false, method: 'logged' }
}

export async function sendCancellationNotification(data: {
  clientName: string
  clientPhone?: string | null
  serviceName: string
  date: string
  time: string
}): Promise<{ sent: boolean; method: string }> {
  const lines: string[] = [
    '*CANCELAMENTO DE SESSAO*',
    '',
    `*Cliente:* ${data.clientName}`,
  ]
  if (data.clientPhone) lines.push(`*Telefone:* ${data.clientPhone}`)
  lines.push(`*Servico:* ${data.serviceName}`)
  lines.push(`*Data:* ${data.date}`)
  lines.push(`*Horario:* ${data.time}`)
  lines.push('')
  lines.push('O horario foi liberado na agenda.')
  const message = lines.join('\n')

  if (hasEvolutionApi()) {
    const ok = await sendViaEvolution(PROFESSIONAL_NUMBER, message)
    if (ok) return { sent: true, method: 'evolution-api' }
  }
  if (hasCallMeBot()) {
    const ok = await sendViaCallMeBot(message)
    if (ok) return { sent: true, method: 'callmebot' }
  }

  console.log('[WhatsApp] Cancelamento logado:\n', message)
  return { sent: false, method: 'logged' }
}
