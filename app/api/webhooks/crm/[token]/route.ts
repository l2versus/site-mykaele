// app/api/webhooks/crm/[token]/route.ts — Endpoint público para webhooks de entrada
// Quando serviços externos (Hotmart, Calendly, etc.) enviam POST para esta URL,
// a ação configurada é executada (criar lead, atualizar lead, etc.)
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ token: string }> }

interface IncomingWebhook {
  id: string
  tenantId: string
  name: string
  token: string
  actionType: string
  actionConfig: Record<string, unknown> | null
  isActive: boolean
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { token } = await ctx.params

  try {
    // Buscar webhook de entrada pelo token
    const rows = await prisma.$queryRawUnsafe<IncomingWebhook[]>(
      `SELECT id, "tenantId", name, token, "actionType", "actionConfig", "isActive"
       FROM crm_webhooks_incoming
       WHERE token = $1`,
      token,
    )

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Webhook não encontrado' }, { status: 404 })
    }

    const webhook = rows[0]!

    if (!webhook.isActive) {
      return NextResponse.json({ error: 'Webhook desativado' }, { status: 403 })
    }

    let body: Record<string, unknown> = {}
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
    }

    // Log da entrada
    await prisma.$executeRawUnsafe(
      `INSERT INTO crm_webhook_logs (id, "tenantId", "webhookId", direction, event, payload, "responseStatus", attempts, "lastAttemptAt", "createdAt")
       VALUES (gen_random_uuid(), $1, $2, 'in', $3, $4::jsonb, 200, 1, NOW(), NOW())`,
      webhook.tenantId,
      webhook.id,
      `incoming.${webhook.actionType}`,
      JSON.stringify(body),
    )

    // Executar ação configurada
    switch (webhook.actionType) {
      case 'create_lead': {
        await handleCreateLead(webhook.tenantId, body, webhook.actionConfig)
        break
      }
      case 'update_lead': {
        await handleUpdateLead(webhook.tenantId, body, webhook.actionConfig)
        break
      }
      case 'custom': {
        // Custom: apenas registra o log (pode ser processado por automação)
        break
      }
      default:
        return NextResponse.json({ error: 'Ação não suportada' }, { status: 400 })
    }

    return NextResponse.json({ status: 'ok', action: webhook.actionType })
  } catch (err) {
    console.error('[webhooks/crm] Erro:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// ─── Ações ──────────────────────────────────────────────────────

async function handleCreateLead(
  tenantId: string,
  body: Record<string, unknown>,
  config: Record<string, unknown> | null,
): Promise<void> {
  // Mapear campos do body para o lead usando actionConfig.fieldMap
  const fieldMap = (config?.fieldMap ?? {}) as Record<string, string>

  const name = String(body[fieldMap.name ?? 'name'] ?? body.customer_name ?? body.nome ?? 'Novo Lead')
  const phone = String(body[fieldMap.phone ?? 'phone'] ?? body.customer_phone ?? body.telefone ?? '')
  const email = String(body[fieldMap.email ?? 'email'] ?? body.customer_email ?? body.email ?? '') || undefined
  const source = String(body[fieldMap.source ?? 'source'] ?? config?.defaultSource ?? 'webhook')
  const value = Number(body[fieldMap.value ?? 'value'] ?? body.price ?? body.valor ?? 0) || undefined

  if (!phone && !email) return // Sem dados de contato, ignorar

  // Verificar se lead já existe pelo telefone
  if (phone) {
    const existing = await prisma.lead.findFirst({
      where: { tenantId, phone, deletedAt: null },
    })
    if (existing) return // Lead já existe, não duplicar
  }

  // Buscar pipeline default e primeiro estágio
  const pipeline = await prisma.pipeline.findFirst({
    where: { tenantId, isDefault: true },
    include: { stages: { orderBy: { order: 'asc' }, take: 1 } },
  })
  if (!pipeline || pipeline.stages.length === 0) return

  const firstStage = pipeline.stages[0]!

  // Buscar última posição
  const lastLead = await prisma.lead.findFirst({
    where: { tenantId, stageId: firstStage.id, deletedAt: null },
    orderBy: { position: 'desc' },
    select: { position: true },
  })

  await prisma.$transaction([
    prisma.lead.create({
      data: {
        tenantId,
        pipelineId: pipeline.id,
        stageId: firstStage.id,
        name,
        phone,
        email,
        source,
        status: 'WARM',
        position: lastLead ? lastLead.position + 1.0 : 1.0,
        expectedValue: value,
        tags: config?.defaultTags ? (config.defaultTags as string[]) : [],
      },
    }),
    prisma.stage.update({
      where: { id: firstStage.id },
      data: {
        cachedLeadCount: { increment: 1 },
        cachedTotalValue: value ? { increment: value } : undefined,
        cacheUpdatedAt: new Date(),
      },
    }),
  ])
}

async function handleUpdateLead(
  tenantId: string,
  body: Record<string, unknown>,
  config: Record<string, unknown> | null,
): Promise<void> {
  const fieldMap = (config?.fieldMap ?? {}) as Record<string, string>
  const phone = String(body[fieldMap.phone ?? 'phone'] ?? body.customer_phone ?? body.telefone ?? '')
  const email = String(body[fieldMap.email ?? 'email'] ?? body.customer_email ?? body.email ?? '')

  if (!phone && !email) return

  // Encontrar lead
  let lead = null
  if (phone) {
    lead = await prisma.lead.findFirst({
      where: { tenantId, phone, deletedAt: null },
    })
  }
  if (!lead && email) {
    lead = await prisma.lead.findFirst({
      where: { tenantId, email, deletedAt: null },
    })
  }
  if (!lead) return

  // Atualizar campos mapeados
  const updates: Record<string, unknown> = {}
  if (body[fieldMap.name ?? 'name']) updates.name = String(body[fieldMap.name ?? 'name'])
  if (body[fieldMap.source ?? 'source']) updates.source = String(body[fieldMap.source ?? 'source'])
  if (body[fieldMap.value ?? 'value']) updates.expectedValue = Number(body[fieldMap.value ?? 'value'])

  // Tags adicionais do body
  const newTags = body[fieldMap.tags ?? 'tags']
  if (Array.isArray(newTags)) {
    const existing = lead.tags ?? []
    updates.tags = [...new Set([...existing, ...newTags.map(String)])]
  }

  if (Object.keys(updates).length > 0) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: updates,
    })
  }
}
