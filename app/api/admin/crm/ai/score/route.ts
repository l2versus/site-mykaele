// app/api/admin/crm/ai/score/route.ts — Enhanced AI Score com explainability
// Calcula score em tempo real com breakdown de fatores + salva no lead
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface ScoreFactor {
  name: string
  weight: number
  score: number
  label: string
  detail: string
}

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const leadId = req.nextUrl.searchParams.get('leadId')
    let tenantId = req.nextUrl.searchParams.get('tenantId')

    if (!leadId || !tenantId) {
      return NextResponse.json({ error: 'leadId e tenantId obrigatórios' }, { status: 400 })
    }

    // Resolver slug → cuid
    const tenantById = await prisma.crmTenant.findUnique({ where: { id: tenantId } })
    if (!tenantById) {
      const tenantBySlug = await prisma.crmTenant.findUnique({ where: { slug: tenantId } })
      if (tenantBySlug) tenantId = tenantBySlug.id
    }

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, tenantId, deletedAt: null },
    })
    if (!lead) {
      return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })
    }

    // Buscar mensagens dos últimos 30 dias
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const messages = await prisma.message.findMany({
      where: {
        conversation: { leadId },
        tenantId,
        createdAt: { gte: thirtyDaysAgo },
      },
      select: { fromMe: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })

    const totalMessages = messages.length
    const incomingMessages = messages.filter(m => !m.fromMe)
    const outgoingMessages = messages.filter(m => m.fromMe)

    const factors: ScoreFactor[] = []

    // Fator 1: Frequência (25%)
    const distinctDays = new Set(
      messages.map(m => m.createdAt.toISOString().slice(0, 10))
    ).size
    const frequencyScore = Math.min(distinctDays / 10, 1) * 100
    factors.push({
      name: 'Frequência',
      weight: 0.25,
      score: Math.round(frequencyScore),
      label: distinctDays > 7 ? 'Alta' : distinctDays > 3 ? 'Média' : 'Baixa',
      detail: `${distinctDays} dias de contato nos últimos 30 dias`,
    })

    // Fator 2: Recência (25%)
    const lastMessage = messages[messages.length - 1]
    let recencyScore = 0
    let recencyDetail = 'Sem mensagens recentes'
    if (lastMessage) {
      const daysSince = (Date.now() - lastMessage.createdAt.getTime()) / (24 * 60 * 60 * 1000)
      if (daysSince < 1) { recencyScore = 100; recencyDetail = 'Última mensagem hoje' }
      else if (daysSince < 3) { recencyScore = 80; recencyDetail = `Última mensagem há ${Math.round(daysSince)} dia(s)` }
      else if (daysSince < 7) { recencyScore = 60; recencyDetail = `Última mensagem há ${Math.round(daysSince)} dias` }
      else if (daysSince < 14) { recencyScore = 30; recencyDetail = `Última mensagem há ${Math.round(daysSince)} dias` }
      else { recencyScore = 10; recencyDetail = `Última mensagem há ${Math.round(daysSince)} dias` }
    }
    factors.push({
      name: 'Recência',
      weight: 0.25,
      score: Math.round(recencyScore),
      label: recencyScore >= 80 ? 'Recente' : recencyScore >= 40 ? 'Moderada' : 'Distante',
      detail: recencyDetail,
    })

    // Fator 3: Volume (20%)
    const volumeScore = Math.min(incomingMessages.length / 20, 1) * 100
    factors.push({
      name: 'Volume',
      weight: 0.20,
      score: Math.round(volumeScore),
      label: incomingMessages.length > 15 ? 'Alto' : incomingMessages.length > 5 ? 'Médio' : 'Baixo',
      detail: `${incomingMessages.length} mensagens recebidas do paciente`,
    })

    // Fator 4: Engajamento (15%)
    let engagementScore = 50
    let engagementDetail = 'Sem dados suficientes'
    if (outgoingMessages.length > 0 && incomingMessages.length > 0) {
      const ratio = incomingMessages.length / outgoingMessages.length
      if (ratio >= 1.5) { engagementScore = 100; engagementDetail = 'Paciente muito responsivo' }
      else if (ratio >= 1) { engagementScore = 80; engagementDetail = 'Conversa equilibrada' }
      else if (ratio >= 0.5) { engagementScore = 60; engagementDetail = 'Clínica conduz a conversa' }
      else { engagementScore = 30; engagementDetail = 'Paciente pouco responsivo' }
    } else if (totalMessages === 0) {
      engagementScore = 0
      engagementDetail = 'Nenhuma interação registrada'
    }
    factors.push({
      name: 'Engajamento',
      weight: 0.15,
      score: Math.round(engagementScore),
      label: engagementScore >= 80 ? 'Alto' : engagementScore >= 50 ? 'Médio' : 'Baixo',
      detail: engagementDetail,
    })

    // Fator 5: Valor (15%)
    let valueScore = 0
    let valueDetail = 'Sem valor estimado'
    if (lead.expectedValue) {
      if (lead.expectedValue >= 5000) { valueScore = 100; valueDetail = `R$ ${lead.expectedValue.toLocaleString('pt-BR')} — alto ticket` }
      else if (lead.expectedValue >= 2000) { valueScore = 80; valueDetail = `R$ ${lead.expectedValue.toLocaleString('pt-BR')} — ticket médio-alto` }
      else if (lead.expectedValue >= 500) { valueScore = 50; valueDetail = `R$ ${lead.expectedValue.toLocaleString('pt-BR')} — ticket médio` }
      else { valueScore = 20; valueDetail = `R$ ${lead.expectedValue.toLocaleString('pt-BR')} — ticket baixo` }
    }
    factors.push({
      name: 'Valor',
      weight: 0.15,
      score: Math.round(valueScore),
      label: valueScore >= 80 ? 'Alto' : valueScore >= 40 ? 'Médio' : 'Baixo',
      detail: valueDetail,
    })

    // Score final ponderado
    const totalScore = Math.round(
      factors.reduce((acc, f) => acc + f.score * f.weight, 0)
    )

    // Label
    let scoreLabel: string
    if (totalScore >= 80) scoreLabel = 'Muito Quente'
    else if (totalScore >= 60) scoreLabel = 'Quente'
    else if (totalScore >= 40) scoreLabel = 'Morno'
    else if (totalScore >= 20) scoreLabel = 'Frio'
    else scoreLabel = 'Gelado'

    // Atualizar score no lead (non-blocking)
    prisma.lead.update({
      where: { id: leadId },
      data: { aiScore: totalScore, aiScoreLabel: scoreLabel },
    }).catch(() => {})

    return NextResponse.json({
      score: totalScore,
      label: scoreLabel,
      factors,
      messageCount: totalMessages,
      incomingCount: incomingMessages.length,
      outgoingCount: outgoingMessages.length,
    })
  } catch (err) {
    console.error('[ai/score] GET error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Falha ao calcular score' }, { status: 500 })
  }
}
