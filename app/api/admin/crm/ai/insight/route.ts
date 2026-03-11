// app/api/admin/crm/ai/insight/route.ts — Gera insight rápido do lead baseado nas mensagens recentes
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

    const leadId = req.nextUrl.searchParams.get('leadId')
    const tenantId = req.nextUrl.searchParams.get('tenantId')

    if (!leadId || !tenantId) {
      return NextResponse.json({ error: 'leadId e tenantId obrigatórios' }, { status: 400 })
    }

    // Buscar últimas mensagens do lead (apenas do paciente)
    const recentMessages = await prisma.message.findMany({
      where: {
        conversation: { leadId, tenantId },
        fromMe: false,
      },
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: { content: true, createdAt: true, sentiment: true },
    })

    if (recentMessages.length === 0) {
      return NextResponse.json({
        insight: null,
        reason: 'Sem mensagens do paciente para analisar',
      })
    }

    // Análise baseada em heurísticas (custo zero, sem LLM)
    const texts = recentMessages.map(m => m.content.toLowerCase())
    const allText = texts.join(' ')

    // Detecção de sentimento por keywords
    const positiveKeywords = [
      'obrigad', 'perfeito', 'maravilh', 'amo', 'amei', 'lindo', 'incrível',
      'quero', 'gostei', 'adorei', 'excelente', 'top', 'show', 'bom', 'boa',
      'agenda', 'marcar', 'quero agendar', 'quando posso', 'disponível',
      'interessad', 'indicar', 'indica', 'recomend',
    ]
    const negativeKeywords = [
      'cancelar', 'desistir', 'caro', 'não quero', 'não gostei', 'ruim',
      'demora', 'reclamar', 'problema', 'insatisf', 'decepcion', 'pior',
      'nunca mais', 'horrível', 'péssim', 'atraso', 'falta',
    ]
    const urgentKeywords = [
      'urgente', 'emergência', 'dor', 'inchad', 'reação', 'alergia',
      'sangr', 'roxo', 'febre', 'mal estar', 'ajuda', 'socorro',
    ]
    const intentKeywords = [
      { pattern: ['botox', 'toxina', 'rugas', 'testa'], label: 'Botox' },
      { pattern: ['preenchimento', 'lábio', 'boca', 'bigode chin'], label: 'Preenchimento' },
      { pattern: ['harmonização', 'harmonizaç', 'rosto', 'facial'], label: 'Harmonização Facial' },
      { pattern: ['bioestimulador', 'radiesse', 'sculptra', 'colágeno'], label: 'Bioestimuladores' },
      { pattern: ['skinbooster', 'hidratação profunda', 'skin'], label: 'Skinbooster' },
      { pattern: ['peeling', 'mancha', 'acne', 'cicatriz'], label: 'Peeling' },
      { pattern: ['microagulha', 'dermaroller'], label: 'Microagulhamento' },
      { pattern: ['preço', 'valor', 'quanto custa', 'tabela', 'promoção'], label: 'Consultando valores' },
      { pattern: ['agendar', 'agenda', 'horário', 'disponib', 'marcar'], label: 'Querendo agendar' },
    ]

    const positiveCount = positiveKeywords.filter(kw => allText.includes(kw)).length
    const negativeCount = negativeKeywords.filter(kw => allText.includes(kw)).length
    const urgentCount = urgentKeywords.filter(kw => allText.includes(kw)).length

    // Determinar sentimento
    let sentiment: 'positive' | 'negative' | 'neutral' | 'urgent' = 'neutral'
    let emoji = '💬'

    if (urgentCount > 0) {
      sentiment = 'urgent'
      emoji = '🚨'
    } else if (positiveCount > negativeCount + 1) {
      sentiment = 'positive'
      emoji = '✨'
    } else if (negativeCount > positiveCount) {
      sentiment = 'negative'
      emoji = '⚠️'
    }

    // Detectar provável interesse
    const detectedIntents: string[] = []
    for (const intent of intentKeywords) {
      if (intent.pattern.some(p => allText.includes(p))) {
        detectedIntents.push(intent.label)
      }
    }

    // Detectar responsividade (tempo médio de resposta baseado no volume)
    const msgCount = recentMessages.length
    const firstMsg = recentMessages[recentMessages.length - 1]
    const lastMsg = recentMessages[0]
    const timeSpanHours = (new Date(lastMsg.createdAt).getTime() - new Date(firstMsg.createdAt).getTime()) / 3600000

    let engagementLevel: 'high' | 'medium' | 'low' = 'medium'
    if (msgCount >= 8 || (msgCount >= 4 && timeSpanHours < 2)) {
      engagementLevel = 'high'
    } else if (msgCount <= 2 && timeSpanHours > 24) {
      engagementLevel = 'low'
    }

    // Gerar insight textual
    const parts: string[] = []

    // Sentimento
    const sentimentLabels = {
      positive: 'demonstrando interesse positivo',
      negative: 'sinalizando insatisfação',
      neutral: 'em fase de exploração',
      urgent: 'necessita atenção urgente',
    }
    parts.push(`Paciente ${sentimentLabels[sentiment]}`)

    // Interesse
    if (detectedIntents.length > 0) {
      parts.push(`com provável interesse em ${detectedIntents.slice(0, 2).join(' e ')}`)
    }

    // Engajamento
    const engagementLabels = {
      high: 'Engajamento alto — responder rápido para não perder a janela.',
      medium: 'Engajamento moderado.',
      low: 'Engajamento baixo — considerar reengajamento proativo.',
    }

    const insight = `${emoji} ${parts.join(', ')}. ${engagementLabels[engagementLevel]}`

    return NextResponse.json({
      insight,
      sentiment,
      engagementLevel,
      detectedIntents,
      messageCount: msgCount,
    })
  } catch (err) {
    console.error('[ai/insight] GET error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Falha ao gerar insight' }, { status: 500 })
  }
}
