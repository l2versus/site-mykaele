// app/api/admin/crm/pipeline/route.ts — Pipeline + Stages (sem leads, anti-N+1)
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    let tenantId = req.nextUrl.searchParams.get('tenantId')
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId é obrigatório' }, { status: 400 })
    }

    // Suporte a lookup por slug (fallback)
    let pipeline = await prisma.pipeline.findFirst({
      where: { tenantId, isDefault: true },
    })

    if (!pipeline) {
      // Tentar por slug
      const tenant = await prisma.crmTenant.findUnique({ where: { slug: tenantId } })
      if (tenant) {
        tenantId = tenant.id
        pipeline = await prisma.pipeline.findFirst({
          where: { tenantId: tenant.id, isDefault: true },
        })
      }
    }

    if (!pipeline) {
      return NextResponse.json({ error: 'Pipeline não encontrado. Execute o seed: npx tsx prisma/seeds/crm-pipeline.ts' }, { status: 404 })
    }

    // Buscar estágios separadamente (anti-N+1)
    const stages = await prisma.stage.findMany({
      where: { pipelineId: pipeline.id },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        name: true,
        type: true,
        order: true,
        color: true,
        cachedLeadCount: true,
        cachedTotalValue: true,
      },
    })

    return NextResponse.json({ pipeline, stages })
  } catch (err) {
    console.error('[pipeline] GET error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
