// app/api/crm/sync-messages/route.ts — Polling de mensagens da Evolution API
// Fallback para quando webhooks não funcionam.
// Busca mensagens novas diretamente da Evolution API e salva no banco.
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { evolutionApi } from '@/lib/evolution-api'
import type { EvolutionMessage } from '@/lib/evolution-api'
import { redis, isRedisReady } from '@/lib/redis'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type MessageType = 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'DOCUMENT'

function extractContent(msg: EvolutionMessage['message']): {
  type: MessageType; content: string; mediaMimeType: string | null; mediaUrl: string | null
} {
  if (!msg) return { type: 'TEXT', content: '', mediaMimeType: null, mediaUrl: null }
  if (msg.imageMessage) return { type: 'IMAGE', content: msg.imageMessage.caption ?? '[Imagem]', mediaMimeType: msg.imageMessage.mimetype ?? null, mediaUrl: msg.imageMessage.url ?? null }
  if (msg.audioMessage) return { type: 'AUDIO', content: '[Áudio]', mediaMimeType: msg.audioMessage.mimetype ?? null, mediaUrl: msg.audioMessage.url ?? null }
  if (msg.videoMessage) return { type: 'VIDEO', content: msg.videoMessage.caption ?? '[Vídeo]', mediaMimeType: msg.videoMessage.mimetype ?? null, mediaUrl: msg.videoMessage.url ?? null }
  if (msg.documentMessage) return { type: 'DOCUMENT', content: msg.documentMessage.fileName ?? '[Documento]', mediaMimeType: msg.documentMessage.mimetype ?? null, mediaUrl: msg.documentMessage.url ?? null }
  const text = msg.conversation ?? msg.extendedTextMessage?.text ?? ''
  return { type: 'TEXT', content: text, mediaMimeType: null, mediaUrl: null }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const rawTenantId = process.env.DEFAULT_TENANT_ID
    if (!rawTenantId) return NextResponse.json({ error: 'Tenant não configurado' }, { status: 500 })

    // Resolver tenant: pode ser slug ou ID
    let tenantId = rawTenantId
    const tenantBySlug = await prisma.crmTenant.findUnique({ where: { slug: rawTenantId } })
    if (tenantBySlug) {
      tenantId = tenantBySlug.id
    } else {
      const tenantById = await prisma.crmTenant.findUnique({ where: { id: rawTenantId } })
      if (!tenantById) return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 500 })
      tenantId = tenantById.id
    }

    // Buscar canal WhatsApp ativo
    const channel = await prisma.crmChannel.findFirst({
      where: { tenantId, type: 'whatsapp', isActive: true },
    })
    if (!channel?.instanceId) {
      return NextResponse.json({ error: `WhatsApp não conectado (tenant: ${tenantId})`, debug: { rawTenantId, tenantId } }, { status: 400 })
    }

    const instanceName = channel.instanceId
    let synced = 0

    // Buscar chats recentes da Evolution API
    let chats: Array<{ remoteJid: string; name?: string }> = []
    try {
      const raw = await evolutionApi.findChats(instanceName)
      chats = (Array.isArray(raw) ? raw : [])
        .filter(c => c.remoteJid?.endsWith('@s.whatsapp.net'))
        .slice(0, 30) // Limitar a 30 chats mais recentes
    } catch (err) {
      console.error('[sync] findChats falhou:', err instanceof Error ? err.message : err)
      return NextResponse.json({ error: 'Falha ao buscar chats da Evolution API' }, { status: 502 })
    }

    // Pipeline padrão para criar leads novos
    const pipeline = await prisma.pipeline.findFirst({
      where: { tenantId, isDefault: true },
      include: { stages: { orderBy: { order: 'asc' }, take: 1 } },
    })
    if (!pipeline || pipeline.stages.length === 0) {
      return NextResponse.json({ error: 'Pipeline padrão não encontrado' }, { status: 500 })
    }
    const firstStage = pipeline.stages[0]

    for (const chat of chats) {
      try {
        // Buscar mensagens deste chat
        const rawResult = await evolutionApi.findMessages(instanceName, chat.remoteJid, 15)
        const messages: EvolutionMessage[] = Array.isArray(rawResult)
          ? rawResult
          : (rawResult as { messages?: EvolutionMessage[] }).messages ?? []

        if (messages.length === 0) continue

        for (const msg of messages) {
          if (!msg.key?.id || !msg.key?.remoteJid) continue
          // Ignorar grupos e status
          if (msg.key.remoteJid.endsWith('@g.us') || msg.key.remoteJid === 'status@broadcast') continue

          // Deduplicar: já existe no banco?
          const existing = await prisma.message.findUnique({
            where: { waMessageId: msg.key.id },
          })
          if (existing) continue

          const phone = msg.key.remoteJid.replace('@s.whatsapp.net', '')
          const pushName = msg.pushName ?? chat.name ?? 'Contato'

          // Buscar ou criar conversa + lead
          await prisma.$transaction(async (tx) => {
            let conversation = await tx.conversation.findUnique({
              where: { tenantId_remoteJid: { tenantId, remoteJid: msg.key.remoteJid } },
            })

            if (!conversation) {
              // Buscar ou criar lead
              let lead = await tx.lead.findFirst({
                where: { tenantId, phone, deletedAt: null },
              })

              if (!lead) {
                const lastLead = await tx.lead.findFirst({
                  where: { tenantId, stageId: firstStage.id, deletedAt: null },
                  orderBy: { position: 'desc' },
                })
                lead = await tx.lead.create({
                  data: {
                    tenantId,
                    pipelineId: pipeline.id,
                    stageId: firstStage.id,
                    name: pushName,
                    phone,
                    source: 'whatsapp',
                    status: 'WARM',
                    position: lastLead ? lastLead.position + 1.0 : 1.0,
                  },
                })
                await tx.stage.update({
                  where: { id: firstStage.id },
                  data: { cachedLeadCount: { increment: 1 }, cacheUpdatedAt: new Date() },
                })
              }

              conversation = await tx.conversation.create({
                data: {
                  tenantId,
                  leadId: lead.id,
                  channelId: channel.id,
                  remoteJid: msg.key.remoteJid,
                  lastMessageAt: new Date(),
                  unreadCount: msg.key.fromMe ? 0 : 1,
                },
              })
            } else {
              if (!msg.key.fromMe) {
                await tx.conversation.update({
                  where: { id: conversation.id },
                  data: {
                    lastMessageAt: new Date(),
                    unreadCount: { increment: 1 },
                    isClosed: false,
                  },
                })
              }
            }

            const { type, content, mediaMimeType, mediaUrl } = extractContent(msg.message)

            await tx.message.create({
              data: {
                conversationId: conversation.id,
                tenantId,
                waMessageId: msg.key.id,
                fromMe: msg.key.fromMe,
                type,
                content,
                mediaMimeType,
                mediaUrl,
                channel: 'whatsapp',
                status: msg.key.fromMe ? 'SENT' : 'RECEIVED',
              },
            })

            await tx.lead.update({
              where: { id: conversation.leadId },
              data: { lastInteractionAt: new Date() },
            })
          })

          synced++
        }
      } catch (err) {
        // Não parar se um chat falhar
        console.error(`[sync] Erro no chat ${chat.remoteJid}:`, err instanceof Error ? err.message : err)
      }
    }

    // Notificar frontend via SSE se sincronizou algo
    if (synced > 0 && isRedisReady()) {
      redis.publish('crm:events', JSON.stringify({
        type: 'messages-synced',
        tenantId,
        data: { count: synced },
      })).catch(() => {})
    }

    return NextResponse.json({ ok: true, synced, chatsChecked: chats.length })
  } catch (err) {
    console.error('[sync] Erro:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
