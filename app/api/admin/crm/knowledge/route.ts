// app/api/admin/crm/knowledge/route.ts — CRUD Base de Conhecimento CRM
// POST agora usa upsertKnowledge() do rag.ts para auto-gerar embeddings
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { upsertKnowledge } from '@/lib/rag'

function resolveTenantSlug(req: NextRequest): string {
  return req.nextUrl.searchParams.get('tenantId') || process.env.DEFAULT_TENANT_ID || 'clinica-mykaele-procopio'
}

async function resolveTenantId(value: string): Promise<string> {
  const tenant = await prisma.crmTenant.findUnique({ where: { slug: value } })
  if (tenant) return tenant.id
  const tenantById = await prisma.crmTenant.findUnique({ where: { id: value } })
  return tenantById?.id ?? value
}

// Verifica quantos chunks de uma fonte têm embedding gerado (via raw SQL)
async function getEmbeddingStatus(
  tenantId: string,
  groupKey: string,
  totalChunks: number,
  isSourceFile: boolean
): Promise<'ready' | 'processing' | 'pending' | 'failed'> {
  try {
    const whereClause = isSourceFile
      ? `"sourceFile" = $1`
      : `"id" = $1`
    const result = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*) as count FROM "CrmKnowledgeBase" WHERE ${whereClause} AND "tenantId" = $2 AND embedding IS NOT NULL`,
      groupKey,
      tenantId
    )
    const embeddedCount = Number(result[0]?.count ?? 0)
    if (embeddedCount === 0) return totalChunks > 0 ? 'pending' : 'pending'
    if (embeddedCount >= totalChunks) return 'ready'
    return 'processing'
  } catch {
    return 'pending'
  }
}

// GET — Lista fontes de conhecimento (agrupadas por sourceFile, chunkIndex=0 como "principal")
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const tenantId = await resolveTenantId(resolveTenantSlug(req))

    const records = await prisma.crmKnowledgeBase.findMany({
      where: { tenantId },
      orderBy: [{ createdAt: 'desc' }],
    })

    // Contar embeddings por grupo via uma única query
    let embeddingCounts = new Map<string, number>()
    try {
      const counts = await prisma.$queryRawUnsafe<Array<{ group_key: string; count: bigint }>>(
        `SELECT COALESCE("sourceFile", id) as group_key, COUNT(*) as count
         FROM "CrmKnowledgeBase"
         WHERE "tenantId" = $1 AND embedding IS NOT NULL
         GROUP BY COALESCE("sourceFile", id)`,
        tenantId
      )
      embeddingCounts = new Map(counts.map(c => [c.group_key, Number(c.count)]))
    } catch {
      // pgvector pode não estar disponível
    }

    // Agrupar: registros com mesmo sourceFile OU chunkIndex=0 são fontes "raiz"
    const sourcesMap = new Map<string, {
      id: string
      title: string
      content: string
      sourceFile: string | null
      isActive: boolean
      createdAt: Date
      updatedAt: Date
      chunks: Array<{ index: number; preview: string; tokenCount: number }>
    }>()

    for (const record of records) {
      const groupKey = record.sourceFile ?? record.id

      if (!sourcesMap.has(groupKey)) {
        sourcesMap.set(groupKey, {
          id: record.id,
          title: record.title,
          content: record.content,
          sourceFile: record.sourceFile,
          isActive: record.isActive,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
          chunks: [],
        })
      }

      const source = sourcesMap.get(groupKey)!
      source.chunks.push({
        index: record.chunkIndex,
        preview: record.content.slice(0, 100) + (record.content.length > 100 ? '...' : ''),
        tokenCount: Math.ceil(record.content.split(/\s+/).length * 1.3),
      })

      if (record.updatedAt > source.updatedAt) {
        source.updatedAt = record.updatedAt
      }
      if (record.chunkIndex === 0) {
        source.id = record.id
        source.title = record.title
        source.content = record.content
        source.isActive = record.isActive
      }
    }

    const sources = Array.from(sourcesMap.entries()).map(([groupKey, s]) => {
      const embeddedCount = embeddingCounts.get(groupKey) ?? 0
      const totalChunks = s.chunks.length
      let embeddingStatus: string = 'pending'
      if (embeddedCount >= totalChunks && totalChunks > 0) embeddingStatus = 'ready'
      else if (embeddedCount > 0) embeddingStatus = 'processing'

      return {
        id: s.id,
        name: s.title,
        content: s.content,
        sourceFile: s.sourceFile,
        isActive: s.isActive,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
        chunks: s.chunks.sort((a, b) => a.index - b.index),
        type: s.sourceFile ? 'FILE' : 'TEXT',
        embeddingStatus,
      }
    })

    return NextResponse.json({ sources })
  } catch (err) {
    console.error('[knowledge] GET error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST — Criar nova fonte de conhecimento com auto-embedding
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await req.json()
    const { name, content, sourceFile, tenantId: tenantSlug, sourceUrl } = body

    if (!name?.trim() || !content?.trim()) {
      return NextResponse.json({ error: 'Nome e conteúdo são obrigatórios' }, { status: 400 })
    }

    const tenantId = await resolveTenantId(tenantSlug || resolveTenantSlug(req))
    const fileKey = sourceFile || (sourceUrl ? `url_${Date.now()}_${encodeURIComponent(sourceUrl)}` : null)

    // Usar rag.ts para chunkar com overlap inteligente + gerar embeddings via Gemini
    const chunkCount = await upsertKnowledge({
      tenantId,
      title: name.trim(),
      content,
      sourceFile: fileKey ?? undefined,
    })

    createAuditLog({
      tenantId,
      userId: payload.userId,
      action: 'KNOWLEDGE_CREATED',
      entityId: fileKey ?? name,
      details: { name, chunks: chunkCount, sourceUrl },
    })

    // Buscar registros criados para retornar
    const whereClause = fileKey
      ? { tenantId, sourceFile: fileKey }
      : { tenantId, title: name.trim(), chunkIndex: 0 }
    const records = await prisma.crmKnowledgeBase.findMany({
      where: whereClause,
      orderBy: { chunkIndex: 'asc' },
    })

    // Verificar status real dos embeddings
    const embStatus = fileKey
      ? await getEmbeddingStatus(tenantId, fileKey, records.length, true)
      : await getEmbeddingStatus(tenantId, records[0]?.id ?? '', 1, false)

    return NextResponse.json({
      source: {
        id: records[0]?.id,
        name: records[0]?.title ?? name,
        content: records[0]?.content ?? content,
        sourceFile: fileKey,
        isActive: true,
        createdAt: records[0]?.createdAt.toISOString(),
        updatedAt: records[0]?.updatedAt.toISOString(),
        chunks: records.map((r, i) => ({
          index: i,
          preview: r.content.slice(0, 100) + (r.content.length > 100 ? '...' : ''),
          tokenCount: Math.ceil(r.content.split(/\s+/).length * 1.3),
        })),
        type: sourceUrl ? 'URL' : fileKey ? 'FILE' : 'TEXT',
        embeddingStatus: embStatus,
      },
    })
  } catch (err) {
    console.error('[knowledge] POST error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// PATCH — Atualizar fonte (conteúdo alterado = re-embeddings)
export async function PATCH(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await req.json()
    const { id, name, content, isActive } = body

    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

    const record = await prisma.crmKnowledgeBase.findUnique({ where: { id } })
    if (!record) return NextResponse.json({ error: 'Fonte não encontrada' }, { status: 404 })

    // Se conteúdo mudou, re-processar com upsertKnowledge (re-chunk + re-embed)
    if (content !== undefined && content !== record.content) {
      const sourceFile = record.sourceFile ?? `text_${record.id}`
      await upsertKnowledge({
        tenantId: record.tenantId,
        title: (name ?? record.title).trim(),
        content,
        sourceFile,
      })
    } else {
      // Apenas atualizar metadados
      await prisma.crmKnowledgeBase.update({
        where: { id },
        data: {
          ...(name !== undefined && { title: name }),
          ...(isActive !== undefined && { isActive }),
        },
      })

      // Se isActive mudou e há chunks irmãos, atualizar todos
      if (isActive !== undefined && record.sourceFile) {
        await prisma.crmKnowledgeBase.updateMany({
          where: {
            tenantId: record.tenantId,
            sourceFile: record.sourceFile,
          },
          data: { isActive },
        })
      }
    }

    createAuditLog({
      tenantId: record.tenantId,
      userId: payload.userId,
      action: 'KNOWLEDGE_UPDATED',
      entityId: id,
    })

    const updated = await prisma.crmKnowledgeBase.findUnique({ where: { id } })

    return NextResponse.json({
      source: {
        id: updated?.id ?? id,
        name: updated?.title ?? name,
        content: updated?.content ?? content,
        isActive: updated?.isActive ?? isActive,
        updatedAt: updated?.updatedAt.toISOString(),
      },
    })
  } catch (err) {
    console.error('[knowledge] PATCH error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// DELETE — Remover fonte e todos os chunks
export async function DELETE(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

    const record = await prisma.crmKnowledgeBase.findUnique({ where: { id } })
    if (!record) return NextResponse.json({ error: 'Fonte não encontrada' }, { status: 404 })

    if (record.sourceFile) {
      await prisma.crmKnowledgeBase.deleteMany({
        where: { tenantId: record.tenantId, sourceFile: record.sourceFile },
      })
    } else {
      await prisma.crmKnowledgeBase.delete({ where: { id } })
    }

    createAuditLog({
      tenantId: record.tenantId,
      userId: payload.userId,
      action: 'KNOWLEDGE_DELETED',
      entityId: id,
      details: { name: record.title },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[knowledge] DELETE error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
