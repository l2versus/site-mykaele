// app/api/admin/crm/knowledge/route.ts — CRUD Base de Conhecimento CRM
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'

function resolveTenantSlug(req: NextRequest): string {
  return req.nextUrl.searchParams.get('tenantId') || process.env.DEFAULT_TENANT_ID || 'clinica-mykaele-procopio'
}

async function resolveTenantId(value: string): Promise<string> {
  const tenant = await prisma.crmTenant.findUnique({ where: { slug: value } })
  if (tenant) return tenant.id
  const tenantById = await prisma.crmTenant.findUnique({ where: { id: value } })
  return tenantById?.id ?? value
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

    // Buscar todos os registros para agrupar por fonte
    const records = await prisma.crmKnowledgeBase.findMany({
      where: { tenantId },
      orderBy: [{ createdAt: 'desc' }],
    })

    // Agrupar: registros com mesmo sourceFile OU chunkIndex=0 são fontes "raiz"
    // Chunks com chunkIndex > 0 são sub-registros
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
      // Chave de agrupamento: sourceFile se existir, senão o ID do registro com chunkIndex=0
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

      // Manter o registro mais recente como referência
      if (record.updatedAt > source.updatedAt) {
        source.updatedAt = record.updatedAt
      }
      // Se é chunkIndex 0, usar como título e conteúdo principal
      if (record.chunkIndex === 0) {
        source.id = record.id
        source.title = record.title
        source.content = record.content
        source.isActive = record.isActive
      }
    }

    const sources = Array.from(sourcesMap.values()).map(s => ({
      id: s.id,
      name: s.title,
      content: s.content,
      sourceFile: s.sourceFile,
      isActive: s.isActive,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      chunks: s.chunks.sort((a, b) => a.index - b.index),
      type: s.sourceFile ? 'FILE' : 'TEXT',
      embeddingStatus: 'ready',
    }))

    return NextResponse.json({ sources })
  } catch (err) {
    console.error('[knowledge] GET error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST — Criar nova fonte de conhecimento
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await req.json()
    const { name, content, sourceFile, tenantId: tenantSlug } = body

    if (!name?.trim() || !content?.trim()) {
      return NextResponse.json({ error: 'Nome e conteúdo são obrigatórios' }, { status: 400 })
    }

    const tenantId = await resolveTenantId(tenantSlug || resolveTenantSlug(req))

    // Dividir conteúdo em chunks (~500 palavras cada)
    const words = content.split(/\s+/)
    const CHUNK_SIZE = 500
    const chunks: string[] = []
    for (let i = 0; i < words.length; i += CHUNK_SIZE) {
      chunks.push(words.slice(i, i + CHUNK_SIZE).join(' '))
    }
    if (chunks.length === 0) chunks.push(content)

    const records = await prisma.$transaction(
      chunks.map((chunkContent, index) =>
        prisma.crmKnowledgeBase.create({
          data: {
            tenantId,
            title: name.trim(),
            content: chunkContent,
            chunkIndex: index,
            sourceFile: sourceFile || null,
            isActive: true,
          },
        })
      )
    )

    createAuditLog({
      tenantId,
      userId: payload.userId,
      action: 'KNOWLEDGE_CREATED',
      entityId: records[0].id,
      details: { name, chunks: chunks.length },
    })

    return NextResponse.json({
      source: {
        id: records[0].id,
        name: records[0].title,
        content,
        sourceFile: records[0].sourceFile,
        isActive: true,
        createdAt: records[0].createdAt.toISOString(),
        updatedAt: records[0].updatedAt.toISOString(),
        chunks: records.map((r, i) => ({
          index: i,
          preview: r.content.slice(0, 100) + (r.content.length > 100 ? '...' : ''),
          tokenCount: Math.ceil(r.content.split(/\s+/).length * 1.3),
        })),
        type: sourceFile ? 'FILE' : 'TEXT',
        embeddingStatus: 'pending',
      },
    })
  } catch (err) {
    console.error('[knowledge] POST error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// PATCH — Atualizar fonte
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

    // Atualizar o registro principal (chunkIndex 0)
    const updated = await prisma.crmKnowledgeBase.update({
      where: { id },
      data: {
        ...(name !== undefined && { title: name }),
        ...(content !== undefined && { content }),
        ...(isActive !== undefined && { isActive }),
      },
    })

    // Se conteúdo mudou e há chunks irmãos, atualizar também
    if (content !== undefined && record.sourceFile) {
      await prisma.crmKnowledgeBase.updateMany({
        where: {
          tenantId: record.tenantId,
          sourceFile: record.sourceFile,
          chunkIndex: { gt: 0 },
        },
        data: { isActive: isActive ?? record.isActive },
      })
    }

    createAuditLog({
      tenantId: record.tenantId,
      userId: payload.userId,
      action: 'KNOWLEDGE_UPDATED',
      entityId: id,
    })

    return NextResponse.json({
      source: {
        id: updated.id,
        name: updated.title,
        content: updated.content,
        isActive: updated.isActive,
        updatedAt: updated.updatedAt.toISOString(),
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

    // Deletar todos os chunks do mesmo sourceFile
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
