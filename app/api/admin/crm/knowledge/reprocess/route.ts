// app/api/admin/crm/knowledge/reprocess/route.ts — Reprocessar embeddings de uma fonte
// Regenera embeddings para todos os chunks de uma fonte existente
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateEmbedding } from '@/lib/rag'
import { createAuditLog } from '@/lib/audit'

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await req.json()
    const { id } = body

    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

    const record = await prisma.crmKnowledgeBase.findUnique({ where: { id } })
    if (!record) return NextResponse.json({ error: 'Fonte não encontrada' }, { status: 404 })

    // Buscar todos os chunks desta fonte
    const chunks = record.sourceFile
      ? await prisma.crmKnowledgeBase.findMany({
          where: { tenantId: record.tenantId, sourceFile: record.sourceFile },
          orderBy: { chunkIndex: 'asc' },
        })
      : [record]

    let successCount = 0
    let failCount = 0

    for (const chunk of chunks) {
      try {
        const embedding = await generateEmbedding(chunk.content)
        await prisma.$executeRawUnsafe(
          `UPDATE "CrmKnowledgeBase" SET embedding = $1::vector WHERE id = $2`,
          JSON.stringify(embedding),
          chunk.id,
        )
        successCount++
      } catch {
        failCount++
        console.error(`[reprocess] Falha ao gerar embedding para chunk ${chunk.id}`)
      }
    }

    createAuditLog({
      tenantId: record.tenantId,
      userId: payload.userId,
      action: 'KNOWLEDGE_REPROCESSED',
      entityId: id,
      details: { total: chunks.length, success: successCount, failed: failCount },
    })

    return NextResponse.json({
      ok: true,
      total: chunks.length,
      success: successCount,
      failed: failCount,
      embeddingStatus: failCount === 0 ? 'ready' : successCount > 0 ? 'processing' : 'failed',
    })
  } catch (err) {
    console.error('[knowledge/reprocess] Error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro ao reprocessar' }, { status: 500 })
  }
}
