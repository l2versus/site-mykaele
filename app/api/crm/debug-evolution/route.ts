// app/api/crm/debug-evolution/route.ts — Diagnóstico: mostra o que a Evolution API retorna
// TEMPORÁRIO — remover em produção depois de resolver o problema
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

async function evoRequest(path: string, method = 'GET', body?: unknown) {
  const baseUrl = (process.env.EVOLUTION_API_URL || '').replace(/\/+$/, '')
  const apiKey = process.env.EVOLUTION_API_KEY || ''
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', apikey: apiKey },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10_000),
  })
  const text = await res.text()
  try { return { status: res.status, data: JSON.parse(text) } } catch { return { status: res.status, data: text } }
}

async function resolveAuth(req: NextRequest) {
  // Tentar Bearer token primeiro
  const bearer = req.headers.get('authorization')?.replace('Bearer ', '')
  if (bearer) {
    const p = verifyToken(bearer)
    if (p && p.role === 'ADMIN') return p
  }
  // Fallback: cookie (para acesso direto no navegador)
  const cookieStore = await cookies()
  const cookieToken = cookieStore.get('token')?.value
  if (cookieToken) {
    const p = verifyToken(cookieToken)
    if (p && p.role === 'ADMIN') return p
  }
  return null
}

async function resolveTenantId() {
  const raw = process.env.DEFAULT_TENANT_ID || ''
  if (!raw) return null
  const bySlug = await prisma.crmTenant.findUnique({ where: { slug: raw } })
  if (bySlug) return bySlug.id
  const byId = await prisma.crmTenant.findUnique({ where: { id: raw } })
  return byId?.id ?? null
}

export async function GET(req: NextRequest) {
  const user = await resolveAuth(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado. Faça login em /admin primeiro.' }, { status: 401 })

  const tenantId = await resolveTenantId()
  if (!tenantId) return NextResponse.json({ error: 'Tenant não encontrado', raw: process.env.DEFAULT_TENANT_ID })

  const channel = await prisma.crmChannel.findFirst({
    where: { tenantId, type: 'whatsapp', isActive: true },
  })

  const results: Record<string, unknown> = {
    tenantId,
    channelFound: !!channel,
    instanceId: channel?.instanceId ?? null,
    evolutionUrl: process.env.EVOLUTION_API_URL ?? 'NÃO CONFIGURADA',
  }

  if (!channel?.instanceId) {
    // Listar TODOS os canais do tenant para debug
    const allChannels = await prisma.crmChannel.findMany({
      where: { tenantId },
      select: { id: true, type: true, instanceId: true, isActive: true, name: true },
    })
    results.allChannels = allChannels
    results.error = 'Nenhum canal WhatsApp ativo encontrado'
    return NextResponse.json(results)
  }

  const inst = channel.instanceId

  // 1. Status da instância
  try { results.connectionState = await evoRequest(`/instance/connectionState/${inst}`) } catch (e) { results.connectionState = String(e) }

  // 2. Webhook configurado
  try { results.webhook = await evoRequest(`/webhook/find/${inst}`) } catch (e) { results.webhook = String(e) }

  // 3. findChats
  let chatsList: Array<{ remoteJid?: string; name?: string }> = []
  try {
    const chatsRaw = await evoRequest(`/chat/findChats/${inst}`)
    results.findChats_status = (chatsRaw as { status: number }).status
    const chatsData = (chatsRaw as { data: unknown }).data
    if (Array.isArray(chatsData)) {
      chatsList = chatsData
      results.findChats_count = chatsData.length
      results.findChats_sample = chatsData.slice(0, 3)
    } else {
      results.findChats_raw = chatsData
    }
  } catch (e) { results.findChats_error = String(e) }

  // 4. Pegar primeiro JID de contato pessoal
  const firstJid = chatsList.find(c => c.remoteJid?.endsWith('@s.whatsapp.net'))?.remoteJid
  results.testedJid = firstJid ?? 'nenhum chat @s.whatsapp.net encontrado'

  if (firstJid) {
    // 5. findMessages — testar 3 formatos
    try {
      const r = await evoRequest(`/chat/findMessages/${inst}`, 'POST', {
        where: { key: { remoteJid: firstJid } }, limit: 5,
      })
      const data = (r as { data: unknown }).data
      results.findMessages_count = Array.isArray(data) ? data.length : 'not array'
      results.findMessages_sample = Array.isArray(data) ? data.slice(0, 2) : data
    } catch (e) { results.findMessages_error = String(e) }

    // 6. fetchMessages (GET endpoint)
    try {
      const r = await evoRequest(`/chat/fetchMessages/${inst}?count=5`)
      results.fetchMessages = r
    } catch (e) { results.fetchMessages_error = String(e) }
  }

  // 7. DB stats
  const dbCount = await prisma.message.count({ where: { tenantId } })
  const dbIncoming = await prisma.message.count({ where: { tenantId, fromMe: false } })
  const dbOutgoing = await prisma.message.count({ where: { tenantId, fromMe: true } })
  results.db = { total: dbCount, incoming: dbIncoming, outgoing: dbOutgoing }

  return NextResponse.json(results, { status: 200 })
}
