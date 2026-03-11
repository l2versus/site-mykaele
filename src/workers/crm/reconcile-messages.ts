// src/workers/crm/reconcile-messages.ts — Reconciliação horária anti-falhas
import type { Job } from 'bullmq'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { evolutionApi } from '../../lib/evolution-api'

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})
pool.on('error', (err) => console.error('[worker/reconcile-messages] Pool error:', err.message))
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

interface ReconcilePayload {
  type: 'reconcile-messages'
}

/**
 * Reconcilia mensagens perdidas entre o CRM e a Evolution API.
 * Roda a cada hora via scheduler.
 *
 * Para cada canal ativo, busca as últimas N mensagens da Evolution API
 * e compara com o banco. Mensagens faltantes são inseridas.
 */
export async function reconcileMessages(job: Job<ReconcilePayload>): Promise<void> {
  const channels = await prisma.crmChannel.findMany({
    where: { isActive: true, instanceId: { not: null } },
  })

  let reconciled = 0

  for (const channel of channels) {
    if (!channel.instanceId) continue

    try {
      const result = await evolutionApi.fetchMessages(channel.instanceId, 30)

      for (const msg of result.messages) {
        const { id, fromMe, remoteJid } = msg.key

        // Ignorar grupos e status
        if (remoteJid.endsWith('@g.us') || remoteJid === 'status@broadcast') continue

        // Checar se já existe
        const exists = await prisma.message.findUnique({
          where: { waMessageId: id },
          select: { id: true },
        })

        if (exists) continue

        // Encontrar conversa
        const conversation = await prisma.conversation.findUnique({
          where: {
            tenantId_remoteJid: {
              tenantId: channel.tenantId,
              remoteJid,
            },
          },
        })

        if (!conversation) continue

        // Extrair conteúdo básico
        const rawMsg = msg.message as Record<string, unknown> | null
        let content = '[Mensagem reconciliada]'
        let type: 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'DOCUMENT' = 'TEXT'

        if (rawMsg) {
          if (typeof rawMsg.conversation === 'string') {
            content = rawMsg.conversation
          } else if (rawMsg.extendedTextMessage) {
            content = (rawMsg.extendedTextMessage as Record<string, unknown>).text as string ?? ''
          } else if (rawMsg.imageMessage) {
            type = 'IMAGE'
            content = '[Imagem]'
          } else if (rawMsg.audioMessage) {
            type = 'AUDIO'
            content = '[Áudio]'
          } else if (rawMsg.videoMessage) {
            type = 'VIDEO'
            content = '[Vídeo]'
          } else if (rawMsg.documentMessage) {
            type = 'DOCUMENT'
            content = '[Documento]'
          }
        }

        await prisma.message.create({
          data: {
            conversationId: conversation.id,
            tenantId: channel.tenantId,
            waMessageId: id,
            fromMe,
            type,
            content,
            status: fromMe ? 'SENT' : 'RECEIVED',
          },
        })

        reconciled++
      }
    } catch (err: unknown) {
      console.error(
        `[reconcile] Falha no canal ${channel.id}:`,
        err instanceof Error ? err.message : err,
      )
    }
  }

  if (reconciled > 0) {
    console.error(`[reconcile] ${reconciled} mensagens reconciliadas`)
  }
  void job
}
