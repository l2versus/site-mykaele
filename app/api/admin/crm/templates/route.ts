// app/api/admin/crm/templates/route.ts — CRUD de templates de mensagem/email
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
    if (!tenantId) return NextResponse.json({ error: 'tenantId obrigatório' }, { status: 400 })

    const tenantById = await prisma.crmTenant.findUnique({ where: { id: tenantId } })
    if (!tenantById) {
      const tenantBySlug = await prisma.crmTenant.findUnique({ where: { slug: tenantId } })
      if (tenantBySlug) tenantId = tenantBySlug.id
    }

    const type = req.nextUrl.searchParams.get('type')
    const category = req.nextUrl.searchParams.get('category')

    const where: Record<string, unknown> = { tenantId }
    if (type) where.type = type
    if (category) where.category = category

    const templates = await prisma.crmTemplate.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    })

    return NextResponse.json({ templates })
  } catch (err) {
    console.error('[templates] GET error:', err)
    return NextResponse.json({ error: 'Erro ao buscar templates' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await req.json()
    let { tenantId, type, name, category, subject, content, variables } = body

    if (!tenantId || !type || !name || !content) {
      return NextResponse.json({ error: 'tenantId, type, name e content são obrigatórios' }, { status: 400 })
    }

    if (!['whatsapp', 'email'].includes(type)) {
      return NextResponse.json({ error: 'type deve ser "whatsapp" ou "email"' }, { status: 400 })
    }

    const tenantById = await prisma.crmTenant.findUnique({ where: { id: tenantId } })
    if (!tenantById) {
      const tenantBySlug = await prisma.crmTenant.findUnique({ where: { slug: tenantId } })
      if (tenantBySlug) tenantId = tenantBySlug.id
    }

    // Auto-detect variables from content
    const detectedVars = Array.from(new Set(
      (content as string).match(/\{\{(\w+)\}\}/g) || []
    ))

    const template = await prisma.crmTemplate.create({
      data: {
        tenantId,
        type,
        name,
        category: category || 'geral',
        subject: type === 'email' ? subject : null,
        content,
        variables: variables || detectedVars,
      },
    })

    return NextResponse.json({ template }, { status: 201 })
  } catch (err) {
    console.error('[templates] POST error:', err)
    return NextResponse.json({ error: 'Erro ao criar template' }, { status: 500 })
  }
}
