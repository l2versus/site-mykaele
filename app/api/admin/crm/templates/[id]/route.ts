// app/api/admin/crm/templates/[id]/route.ts — Template individual: GET, PUT, DELETE + duplicate
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, ctx: RouteContext) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await ctx.params
    const template = await prisma.crmTemplate.findUnique({ where: { id } })
    if (!template) return NextResponse.json({ error: 'Template não encontrado' }, { status: 404 })

    return NextResponse.json({ template })
  } catch (err) {
    console.error('[templates] GET by id error:', err)
    return NextResponse.json({ error: 'Erro ao buscar template' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, ctx: RouteContext) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await ctx.params
    const body = await req.json()
    const { name, type, category, subject, content, variables, isActive } = body

    const existing = await prisma.crmTemplate.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Template não encontrado' }, { status: 404 })

    // Auto-detect variables if content changed and variables not explicitly provided
    let detectedVars = variables
    if (content && !variables) {
      detectedVars = Array.from(new Set(
        (content as string).match(/\{\{(\w+)\}\}/g) || []
      ))
    }

    const template = await prisma.crmTemplate.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(type !== undefined && { type }),
        ...(category !== undefined && { category }),
        ...(subject !== undefined && { subject }),
        ...(content !== undefined && { content }),
        ...(detectedVars !== undefined && { variables: detectedVars }),
        ...(isActive !== undefined && { isActive }),
      },
    })

    return NextResponse.json({ template })
  } catch (err) {
    console.error('[templates] PUT error:', err)
    return NextResponse.json({ error: 'Erro ao atualizar template' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await ctx.params

    const existing = await prisma.crmTemplate.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Template não encontrado' }, { status: 404 })

    await prisma.crmTemplate.delete({ where: { id } })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[templates] DELETE error:', err)
    return NextResponse.json({ error: 'Erro ao excluir template' }, { status: 500 })
  }
}

// POST to this endpoint = duplicate
export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await ctx.params
    const original = await prisma.crmTemplate.findUnique({ where: { id } })
    if (!original) return NextResponse.json({ error: 'Template não encontrado' }, { status: 404 })

    const duplicate = await prisma.crmTemplate.create({
      data: {
        tenantId: original.tenantId,
        type: original.type,
        name: `${original.name} (cópia)`,
        category: original.category,
        subject: original.subject,
        content: original.content,
        variables: original.variables,
      },
    })

    return NextResponse.json({ template: duplicate }, { status: 201 })
  } catch (err) {
    console.error('[templates] POST duplicate error:', err)
    return NextResponse.json({ error: 'Erro ao duplicar template' }, { status: 500 })
  }
}
