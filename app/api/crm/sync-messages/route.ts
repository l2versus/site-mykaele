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

/** Resolve tenant: tenta por slug, depois por ID. Cacheia na request. */
async function resolveTenant(rawId: string): Promise<string> {
  const bySlug = await prisma.crmTenant.findUnique({ where: { slug: rawId }, select: { id: true } })
  if (bySlug) return bySlug.id
  return rawId // Usar raw — pode ser ID direto
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

    const tenantId = await resolveTenant(rawTenantId)

    // Buscar canal WhatsApp ativo — tentar com resolved e raw
    let channel = await prisma.crmChannel.findFirst({
      where: { tenantId, type: 'whatsapp', isActive: true },
    })
    if (!channel && tenantId !== rawTenantId) {
      channel = await prisma.crmChannel.findFirst({
        where: { tenantId: rawTenantId, type: 'whatsapp', isActive: true },
      })
    }
    if (!channel?.instanceId) {
      return NextResponse.json({ error: 'WhatsApp não conectado' }, { status: 400 })
    }

    // Usar o tenantId real do canal (pode ser diferente do env)
    const effectiveTenantId = channel.tenantId
    const instanceName = channel.instanceId
    let synced = 0
    let errors = 0

    // Buscar chats recentes da Evolution API
    // NOTA: findChats retorna { id: "...@s.whatsapp.net" }, NÃO { remoteJid }
    type ChatItem = { id?: string; remoteJid?: string; name?: string; lastMsgTimestamp?: number }
    let chats: ChatItem[] = []
    try {
      const raw = await evolutionApi.findChats(instanceName)
      const allChats: ChatItem[] = Array.isArray(raw) ? raw : []
      // Filtrar apenas contatos pessoais (não grupos)
      // Campo pode ser "id" ou "remoteJid" dependendo da versão
      chats = allChats
        .filter(c => {
          const jid = c.id ?? c.remoteJid ?? ''
          return jid.endsWith('@s.whatsapp.net')
        })
        .sort((a, b) => (b.lastMsgTimestamp ?? 0) - (a.lastMsgTimestamp ?? 0))
        .slice(0, 20) // Top 20 chats mais recentes
    } catch (err) {
      console.error('[sync] findChats falhou:', err instanceof Error ? err.message : err)
      return NextResponse.json({ error: 'Falha ao buscar chats da Evolution API' }, { status: 502 })
    }

    if (chats.length === 0) {
      return NextResponse.json({ ok: true, synced: 0, chatsChecked: 0, note: 'Nenhum chat pessoal encontrado' })
    }

    // Pipeline padrão para criar leads novos
    const pipeline = await prisma.pipeline.findFirst({
      where: { tenantId: effectiveTenantId, isDefault: true },
      include: { stages: { orderBy: { order: 'asc' }, take: 1 } },
    })
    if (!pipeline || pipeline.stages.length === 0) {
      return NextResponse.json({ error: 'Pipeline padrão não encontrado' }, { status: 500 })
    }
    const firstStage = pipeline.stages[0]

    for (const chat of chats) {
      const chatJid = chat.id ?? chat.remoteJid ?? ''
      if (!chatJid) continue

      try {
        // Buscar mensagens deste chat via findMessages
        const rawResult = await evolutionApi.findMessages(instanceName, chatJid, 15)

        // A resposta pode ser: array direto, { messages: [...] }, ou { data: [...] }
        let messages: EvolutionMessage[] = []
        if (Array.isArray(rawResult)) {
          messages = rawResult
        } else {
          const obj = rawResult as Record<string, unknown>
          const inner = obj.messages ?? obj.data
          if (Array.isArray(inner)) {
            messages = inner as EvolutionMessage[]
          }
        }

        if (messages.length === 0) continue

        for (const msg of messages) {
          if (!msg.key?.id) continue

          // Usar o remoteJid da mensagem, ou do chat se não tiver
          const remoteJid = msg.key.remoteJid || chatJid
          if (remoteJid.endsWith('@g.us') || remoteJid === 'status@broadcast') continue

          // Deduplicar: já existe no banco?
          const existing = await prisma.message.findUnique({
            where: { waMessageId: msg.key.id },
          })
          if (existing) continue

          const phone = remoteJid.replace('@s.whatsapp.net', '').replace('@c.us', '')
          const pushName = msg.pushName ?? chat.name ?? 'Contato'

          // Buscar ou criar conversa + lead
          try {
            await prisma.$transaction(async (tx) => {
              let conversation = await tx.conversation.findUnique({
                where: { tenantId_remoteJid: { tenantId: effectiveTenantId, remoteJid } },
              })

              if (!conversation) {
                let lead = await tx.lead.findFirst({
                  where: { tenantId: effectiveTenantId, phone, deletedAt: null },
                })

                if (!lead) {
                  const lastLead = await tx.lead.findFirst({
                    where: { tenantId: effectiveTenantId, stageId: firstStage.id, deletedAt: null },
                    orderBy: { position: 'desc' },
                  })
                  lead = await tx.lead.create({
                    data: {
                      tenantId: effectiveTenantId,
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
                    tenantId: effectiveTenantId,
                    leadId: lead.id,
                    channelId: channel.id,
                    remoteJid,
                    lastMessageAt: new Date(),
                    unreadCount: msg.key.fromMe ? 0 : 1,
                  },
                })
              } else if (!msg.key.fromMe) {
                await tx.conversation.update({
                  where: { id: conversation.id },
                  data: {
                    lastMessageAt: new Date(),
                    unreadCount: { increment: 1 },
                    isClosed: false,
                  },
                })
              }

              const { type, content, mediaMimeType, mediaUrl } = extractContent(msg.message)

              await tx.message.create({
                data: {
                  conversationId: conversation.id,
                  tenantId: effectiveTenantId,
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
          } catch (txErr) {
            // Provavelmente duplicata — ignorar
            const msg2 = txErr instanceof Error ? txErr.message : ''
            if (!msg2.includes('Unique constraint')) {
              console.error(`[sync] Erro na transação:`, msg2.slice(0, 200))
              errors++
            }
          }
        }
      } catch (err) {
        console.error(`[sync] Erro no chat ${chatJid}:`, err instanceof Error ? err.message : err)
        errors++
      }
    }

    // Notificar frontend via SSE se sincronizou algo
    if (synced > 0 && isRedisReady()) {
      redis.publish('crm:events', JSON.stringify({
        type: 'messages-synced',
        tenantId: effectiveTenantId,
        data: { count: synced },
      })).catch(() => {})
    }

    return NextResponse.json({ ok: true, synced, errors, chatsChecked: chats.length })
  } catch (err) {
    console.error('[sync] Erro:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
