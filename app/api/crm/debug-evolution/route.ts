// app/api/crm/debug-evolution/route.ts — Diagnóstico: mostra o que a Evolution API retorna
// TEMPORÁRIO — remover em produção depois de resolver o problema
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const payload = verifyToken(token)
  if (!payload || payload.role !== 'ADMIN') return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const tenantId = process.env.DEFAULT_TENANT_ID || ''
  const channel = await prisma.crmChannel.findFirst({
    where: { tenantId, type: 'whatsapp', isActive: true },
  })
  if (!channel?.instanceId) return NextResponse.json({ error: 'Sem canal WhatsApp' })

  const inst = channel.instanceId
  const results: Record<string, unknown> = { instanceName: inst }

  // 1. Status da instância
  try { results.status = await evoRequest(`/instance/connectionState/${inst}`) } catch (e) { results.status = String(e) }

  // 2. Webhook configurado
  try { results.webhook = await evoRequest(`/webhook/find/${inst}`) } catch (e) { results.webhook = String(e) }

  // 3. findChats — lista de chats
  try { results.findChats = await evoRequest(`/chat/findChats/${inst}`) } catch (e) { results.findChats = String(e) }

  // 4. fetchMessages — mensagens recentes (GET simples)
  try { results.fetchMessages = await evoRequest(`/chat/fetchMessages/${inst}?count=10`) } catch (e) { results.fetchMessages = String(e) }

  // 5. findMessages via POST — com o primeiro chat que encontrar
  const chatsData = results.findChats as { data?: Array<{ remoteJid?: string }> } | undefined
  const firstJid = Array.isArray(chatsData?.data)
    ? chatsData.data.find((c: { remoteJid?: string }) => c.remoteJid?.endsWith('@s.whatsapp.net'))?.remoteJid
    : null

  if (firstJid) {
    // Tentar diferentes formatos de body para findMessages
    try {
      results.findMessages_v1 = await evoRequest(`/chat/findMessages/${inst}`, 'POST', {
        where: { key: { remoteJid: firstJid } }, limit: 5,
      })
    } catch (e) { results.findMessages_v1 = String(e) }

    try {
      results.findMessages_v2 = await evoRequest(`/chat/findMessages/${inst}`, 'POST', {
        where: { key: { remoteJid: firstJid } },
      })
    } catch (e) { results.findMessages_v2 = String(e) }

    // Tentar endpoint alternativo
    try {
      results.findMessages_v3 = await evoRequest(`/chat/findMessages/${inst}/${firstJid}`)
    } catch (e) { results.findMessages_v3 = String(e) }

    results.testedJid = firstJid
  }

  // 6. Quantas mensagens temos no banco
  const dbCount = await prisma.message.count({ where: { tenantId } })
  const dbRecent = await prisma.message.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { id: true, waMessageId: true, fromMe: true, content: true, createdAt: true },
  })
  results.dbMessageCount = dbCount
  results.dbRecentMessages = dbRecent

  return NextResponse.json(results, { status: 200 })
}
