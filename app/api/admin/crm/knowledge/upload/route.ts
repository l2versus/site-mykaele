// app/api/admin/crm/knowledge/upload/route.ts — Upload de arquivos para base de conhecimento
// Aceita FormData com arquivo (PDF, TXT, CSV, DOCX) + metadados
// Processa: extrai texto → chunka → gera embeddings via Gemini → salva no pgvector
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { upsertKnowledge } from '@/lib/rag'
import { createAuditLog } from '@/lib/audit'
import { prisma } from '@/lib/prisma'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

const ALLOWED_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
}

async function resolveTenantId(slug: string): Promise<string> {
  const tenant = await prisma.crmTenant.findUnique({ where: { slug } })
  if (tenant) return tenant.id
  const tenantById = await prisma.crmTenant.findUnique({ where: { id: slug } })
  return tenantById?.id ?? slug
}

async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  const pdfParseModule = await import('pdf-parse')
  const pdfParse = 'default' in pdfParseModule ? (pdfParseModule as Record<string, unknown>).default as (buf: Buffer) => Promise<{ text: string }> : pdfParseModule
  const data = await (pdfParse as (buf: Buffer) => Promise<{ text: string }>)(buffer)
  return data.text
}

function extractTextFromCSV(text: string): string {
  // CSV: cada linha vira uma sentença legível
  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length === 0) return ''

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  const rows = lines.slice(1)

  return rows.map(row => {
    const values = row.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
    return headers.map((h, i) => `${h}: ${values[i] || ''}`).join(' | ')
  }).join('\n')
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const name = formData.get('name') as string | null
    const tenantSlug = formData.get('tenantId') as string | null

    if (!file) {
      return NextResponse.json({ error: 'Arquivo obrigatório' }, { status: 400 })
    }

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Arquivo excede 10MB' }, { status: 400 })
    }

    const fileType = ALLOWED_TYPES[file.type]
    if (!fileType && !file.name.match(/\.(pdf|txt|csv|docx)$/i)) {
      return NextResponse.json(
        { error: 'Tipo não suportado. Use PDF, TXT, CSV ou DOCX.' },
        { status: 400 }
      )
    }

    const tenantId = await resolveTenantId(
      tenantSlug || process.env.DEFAULT_TENANT_ID || 'clinica-mykaele-procopio'
    )

    // Extrair texto do arquivo
    let extractedText = ''
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const ext = fileType || file.name.split('.').pop()?.toLowerCase() || ''

    if (ext === 'pdf') {
      extractedText = await extractTextFromPDF(buffer)
    } else if (ext === 'txt') {
      extractedText = buffer.toString('utf-8')
    } else if (ext === 'csv') {
      extractedText = extractTextFromCSV(buffer.toString('utf-8'))
    } else if (ext === 'docx') {
      // DOCX: extrair texto dos XML internos (abordagem simplificada)
      // Para DOCX completo, usar mammoth. Por ora, tratar como texto.
      extractedText = buffer.toString('utf-8').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
    }

    if (!extractedText.trim()) {
      return NextResponse.json(
        { error: 'Não foi possível extrair texto do arquivo' },
        { status: 400 }
      )
    }

    // Usar rag.ts para chunkar + gerar embeddings
    const sourceFile = `upload_${Date.now()}_${file.name}`
    const chunkCount = await upsertKnowledge({
      tenantId,
      title: name.trim(),
      content: extractedText,
      sourceFile,
    })

    createAuditLog({
      tenantId,
      userId: payload.userId,
      action: 'KNOWLEDGE_UPLOADED',
      details: {
        name: name.trim(),
        fileName: file.name,
        fileSize: file.size,
        fileType: ext,
        chunks: chunkCount,
      },
    })

    // Buscar registros criados para retornar
    const records = await prisma.crmKnowledgeBase.findMany({
      where: { tenantId, sourceFile },
      orderBy: { chunkIndex: 'asc' },
    })

    // Verificar quantos têm embedding
    const embeddedCount = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*) as count FROM "CrmKnowledgeBase" WHERE "sourceFile" = $1 AND embedding IS NOT NULL`,
      sourceFile
    )
    const hasEmbeddings = Number(embeddedCount[0]?.count ?? 0)
    const embeddingStatus = hasEmbeddings === records.length
      ? 'ready'
      : hasEmbeddings > 0
        ? 'processing'
        : 'failed'

    return NextResponse.json({
      source: {
        id: records[0]?.id,
        name: name.trim(),
        type: 'FILE',
        sourceFile,
        isActive: true,
        createdAt: records[0]?.createdAt.toISOString(),
        updatedAt: records[0]?.updatedAt.toISOString(),
        chunks: records.map((r, i) => ({
          index: i,
          preview: r.content.slice(0, 100) + (r.content.length > 100 ? '...' : ''),
          tokenCount: Math.ceil(r.content.split(/\s+/).length * 1.3),
        })),
        embeddingStatus,
        chunkCount,
      },
    })
  } catch (err) {
    console.error('[knowledge/upload] Error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro ao processar arquivo' }, { status: 500 })
  }
}
