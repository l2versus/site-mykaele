// app/api/admin/crm/nps/route.ts — Config + Respostas NPS + Envio manual
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { evolutionApi } from '@/lib/evolution-api'
import { createAuditLog } from '@/lib/audit'

function resolveTenant(tenantId: string) {
  return prisma.crmTenant.findFirst({
    where: { OR: [{ id: tenantId }, { slug: tenantId }] },
    select: { id: true },
  })
}

function classifyScore(score: number): string {
  if (score >= 9) return 'promoter'
  if (score >= 7) return 'neutral'
  return 'detractor'
}

// GET — Config NPS + respostas + métricas
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const tenantParam = req.nextUrl.searchParams.get('tenantId')
    if (!tenantParam) return NextResponse.json({ error: 'tenantId obrigatório' }, { status: 400 })

    const tenant = await resolveTenant(tenantParam)
    if (!tenant) return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 })

    // Lead search (for send/manual modals)
    const searchLeads = req.nextUrl.searchParams.get('searchLeads')
    if (searchLeads && searchLeads.length >= 2) {
      const leads = await prisma.lead.findMany({
        where: {
          tenantId: tenant.id,
          deletedAt: null,
          OR: [
            { name: { contains: searchLeads, mode: 'insensitive' } },
            { phone: { contains: searchLeads } },
          ],
        },
        select: { id: true, name: true, phone: true },
        take: 10,
        orderBy: { name: 'asc' },
      })
      return NextResponse.json({ leads })
    }

    // Get or create config
    let config = await prisma.crmNpsConfig.findUnique({ where: { tenantId: tenant.id } })
    if (!config) {
      config = await prisma.crmNpsConfig.create({
        data: { tenantId: tenant.id },
      })
    }

    // Get responses with pagination
    const page = Number(req.nextUrl.searchParams.get('page') || '1')
    const limit = 20
    const skip = (page - 1) * limit

    const [responses, totalResponses] = await Promise.all([
      prisma.crmNpsResponse.findMany({
        where: { tenantId: tenant.id },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      prisma.crmNpsResponse.count({ where: { tenantId: tenant.id } }),
    ])

    // Calculate NPS metrics
    const allResponses = await prisma.crmNpsResponse.groupBy({
      by: ['category'],
      where: { tenantId: tenant.id },
      _count: true,
    })

    const counts = { promoter: 0, neutral: 0, detractor: 0 }
    for (const r of allResponses) {
      if (r.category in counts) counts[r.category as keyof typeof counts] = r._count
    }

    const total = counts.promoter + counts.neutral + counts.detractor
    const npsScore = total > 0
      ? Math.round(((counts.promoter - counts.detractor) / total) * 100)
      : null

    // Monthly trend (last 6 months)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const monthlyResponses = await prisma.crmNpsResponse.findMany({
      where: { tenantId: tenant.id, createdAt: { gte: sixMonthsAgo } },
      select: { score: true, category: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })

    const monthlyTrend: Array<{ month: string; nps: number; total: number }> = []
    const monthGroups = new Map<string, Array<{ score: number; category: string }>>()

    for (const r of monthlyResponses) {
      const key = `${r.createdAt.getFullYear()}-${String(r.createdAt.getMonth() + 1).padStart(2, '0')}`
      if (!monthGroups.has(key)) monthGroups.set(key, [])
      monthGroups.get(key)!.push({ score: r.score, category: r.category })
    }

    for (const [month, items] of monthGroups) {
      const p = items.filter(i => i.category === 'promoter').length
      const d = items.filter(i => i.category === 'detractor').length
      const t = items.length
      monthlyTrend.push({
        month,
        nps: t > 0 ? Math.round(((p - d) / t) * 100) : 0,
        total: t,
      })
    }

    return NextResponse.json({
      config,
      responses,
      totalResponses,
      page,
      totalPages: Math.ceil(totalResponses / limit),
      metrics: { npsScore, total, ...counts },
      monthlyTrend,
    })
  } catch (err) {
    console.error('[nps] GET error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST — Atualizar config OU enviar NPS manual OU registrar resposta
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await req.json()
    const { tenantId: tenantParam, action } = body

    if (!tenantParam) return NextResponse.json({ error: 'tenantId obrigatório' }, { status: 400 })

    const tenant = await resolveTenant(tenantParam)
    if (!tenant) return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 })

    // UPDATE CONFIG
    if (action === 'updateConfig') {
      const { isActive, triggerType, triggerStageId, templateMessage, thankYouPromoter, thankYouNeutral, thankYouDetractor, cooldownDays } = body

      const config = await prisma.crmNpsConfig.upsert({
        where: { tenantId: tenant.id },
        create: {
          tenantId: tenant.id,
          isActive: isActive ?? false,
          triggerType: triggerType || 'manual',
          triggerStageId,
          templateMessage,
          thankYouPromoter,
          thankYouNeutral,
          thankYouDetractor,
          cooldownDays: cooldownDays ?? 30,
        },
        update: {
          ...(isActive !== undefined && { isActive }),
          ...(triggerType && { triggerType }),
          ...(triggerStageId !== undefined && { triggerStageId }),
          ...(templateMessage && { templateMessage }),
          ...(thankYouPromoter && { thankYouPromoter }),
          ...(thankYouNeutral && { thankYouNeutral }),
          ...(thankYouDetractor && { thankYouDetractor }),
          ...(cooldownDays !== undefined && { cooldownDays }),
        },
      })

      return NextResponse.json({ config })
    }

    // SEND NPS to specific lead
    if (action === 'sendNps') {
      const { leadId } = body
      if (!leadId) return NextResponse.json({ error: 'leadId obrigatório' }, { status: 400 })

      const lead = await prisma.lead.findFirst({
        where: { id: leadId, tenantId: tenant.id, deletedAt: null },
      })
      if (!lead) return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })

      // Check cooldown
      const config = await prisma.crmNpsConfig.findUnique({ where: { tenantId: tenant.id } })
      const cooldownDays = config?.cooldownDays ?? 30
      const cooldownDate = new Date()
      cooldownDate.setDate(cooldownDate.getDate() - cooldownDays)

      const recentNps = await prisma.crmNpsResponse.findFirst({
        where: { tenantId: tenant.id, leadId, sentAt: { gte: cooldownDate } },
      })

      if (recentNps) {
        return NextResponse.json({
          error: `NPS já enviado para este lead nos últimos ${cooldownDays} dias`,
        }, { status: 400 })
      }

      // Send via WhatsApp
      const channel = await prisma.crmChannel.findFirst({
        where: { tenantId: tenant.id, type: 'whatsapp', isActive: true },
      })

      const templateMsg = config?.templateMessage || 'Olá {{nome}}! De 0 a 10, o quanto você recomendaria nosso serviço? Responda apenas com o número.'
      const personalizedMsg = templateMsg.replace(/\{\{nome\}\}/g, lead.name).replace(/\{\{primeiro_nome\}\}/g, lead.name.split(' ')[0])

      if (channel?.instanceId && lead.phone) {
        try {
          await evolutionApi.sendText(channel.instanceId, lead.phone, personalizedMsg)
        } catch (err) {
          console.error('[nps] Send error:', err instanceof Error ? err.message : err)
        }
      }

      // Create pending response record
      const response = await prisma.crmNpsResponse.create({
        data: {
          tenantId: tenant.id,
          leadId: lead.id,
          leadName: lead.name,
          score: -1, // pending
          category: 'pending',
          triggeredBy: 'manual',
          sentAt: new Date(),
        },
      })

      createAuditLog({
        tenantId: tenant.id,
        userId: payload.userId,
        action: 'NPS_SENT',
        entityId: response.id,
        details: { leadId, leadName: lead.name },
      })

      return NextResponse.json({ response }, { status: 201 })
    }

    // RECORD RESPONSE (score received)
    if (action === 'recordResponse') {
      const { responseId, score, feedback } = body
      if (!responseId || score === undefined) {
        return NextResponse.json({ error: 'responseId e score são obrigatórios' }, { status: 400 })
      }

      const numScore = Number(score)
      if (numScore < 0 || numScore > 10) {
        return NextResponse.json({ error: 'Score deve ser entre 0 e 10' }, { status: 400 })
      }

      const category = classifyScore(numScore)

      const response = await prisma.crmNpsResponse.update({
        where: { id: responseId },
        data: {
          score: numScore,
          category,
          feedback: feedback || null,
          respondedAt: new Date(),
        },
      })

      // Send thank you message
      const config = await prisma.crmNpsConfig.findUnique({ where: { tenantId: tenant.id } })
      const lead = await prisma.lead.findFirst({
        where: { id: response.leadId, tenantId: tenant.id },
      })

      if (lead?.phone && config) {
        const channel = await prisma.crmChannel.findFirst({
          where: { tenantId: tenant.id, type: 'whatsapp', isActive: true },
        })

        if (channel?.instanceId) {
          let thankYouMsg = config.thankYouNeutral
          if (category === 'promoter') thankYouMsg = config.thankYouPromoter
          else if (category === 'detractor') thankYouMsg = config.thankYouDetractor

          try {
            await evolutionApi.sendText(channel.instanceId, lead.phone, thankYouMsg)
          } catch (err) {
            console.error('[nps] Thank you send error:', err instanceof Error ? err.message : err)
          }
        }
      }

      return NextResponse.json({ response })
    }

    // ADD MANUAL RESPONSE (admin registers score directly)
    if (action === 'addManual') {
      const { leadId, score, feedback } = body
      if (!leadId || score === undefined) {
        return NextResponse.json({ error: 'leadId e score obrigatórios' }, { status: 400 })
      }

      const numScore = Number(score)
      if (numScore < 0 || numScore > 10) {
        return NextResponse.json({ error: 'Score deve ser entre 0 e 10' }, { status: 400 })
      }

      const lead = await prisma.lead.findFirst({
        where: { id: leadId, tenantId: tenant.id, deletedAt: null },
      })
      if (!lead) return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })

      const category = classifyScore(numScore)

      const response = await prisma.crmNpsResponse.create({
        data: {
          tenantId: tenant.id,
          leadId: lead.id,
          leadName: lead.name,
          score: numScore,
          category,
          feedback: feedback || null,
          triggeredBy: 'manual',
          respondedAt: new Date(),
        },
      })

      return NextResponse.json({ response }, { status: 201 })
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  } catch (err) {
    console.error('[nps] POST error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// DELETE — Remove resposta NPS
export async function DELETE(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

    await prisma.crmNpsResponse.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[nps] DELETE error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
