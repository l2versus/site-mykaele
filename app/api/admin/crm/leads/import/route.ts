// app/api/admin/crm/leads/import/route.ts — Importar pacientes existentes como leads
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog, CRM_ACTIONS } from '@/lib/audit'

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '')
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
    const tenantSlug = body.tenantId || process.env.DEFAULT_TENANT_ID || 'clinica-mykaele-procopio'

    // 1. Encontrar tenant (por ID ou slug)
    let tenant = await prisma.crmTenant.findUnique({ where: { id: tenantSlug } })
    if (!tenant) {
      tenant = await prisma.crmTenant.findUnique({ where: { slug: tenantSlug } })
    }
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant não encontrado. Execute o seed primeiro.' }, { status: 404 })
    }

    // 2. Encontrar pipeline padrão e estágios
    const pipeline = await prisma.pipeline.findFirst({
      where: { tenantId: tenant.id, isDefault: true },
    })
    if (!pipeline) {
      return NextResponse.json({ error: 'Pipeline não encontrado. Execute o seed primeiro.' }, { status: 404 })
    }

    const stages = await prisma.stage.findMany({
      where: { pipelineId: pipeline.id },
      orderBy: { order: 'asc' },
    })

    if (stages.length === 0) {
      return NextResponse.json({ error: 'Nenhum estágio encontrado.' }, { status: 404 })
    }

    // Mapear estágios por nome real (robusto) — match semântico, fallback por order
    const findStage = (namePatterns: string[], fallbackOrder: number) => {
      for (const pattern of namePatterns) {
        const match = stages.find(s => s.name.toLowerCase().includes(pattern))
        if (match) return match
      }
      return stages.find(s => s.order === fallbackOrder) ?? stages[0]
    }

    const stageMap = {
      novoContato: findStage(['novo contato', 'primeiro contato', 'lead'], 0),
      emAtendimento: findStage(['atendimento', 'acompanhamento', 'follow'], 1),
      agendamento: findStage(['agendamento', 'agendado', 'proposta'], 3),
      ganho: stages.find(s => s.type === 'WON') ?? stages[stages.length - 1] ?? stages[0],
    }

    // 3. Buscar todos os pacientes
    const patients = await prisma.user.findMany({
      where: { role: 'PATIENT' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
        appointments: {
          select: {
            id: true,
            status: true,
            scheduledAt: true,
            price: true,
            type: true,
          },
          orderBy: { scheduledAt: 'desc' },
          take: 10,
        },
      },
    })

    // 4. Buscar leads existentes para evitar duplicatas
    const existingLeads = await prisma.lead.findMany({
      where: { tenantId: tenant.id, deletedAt: null },
      select: { phone: true, patientId: true, email: true },
    })

    const existingPhones = new Set(existingLeads.map(l => normalizePhone(l.phone)))
    const existingPatientIds = new Set(existingLeads.filter(l => l.patientId).map(l => l.patientId))

    // 5. Filtrar pacientes que já são leads
    const newPatients = patients.filter(p => {
      if (existingPatientIds.has(p.id)) return false
      if (p.phone && existingPhones.has(normalizePhone(p.phone))) return false
      return true
    })

    if (newPatients.length === 0) {
      return NextResponse.json({
        ok: true,
        imported: 0,
        skipped: patients.length,
        message: 'Todos os pacientes já estão no CRM',
      })
    }

    // 6. Criar leads em lote
    const now = new Date()
    let imported = 0
    const classification = { hot: 0, warm: 0, cold: 0, vipCount: 0 }
    const stageCountUpdates: Record<string, { count: number; value: number }> = {}

    for (const patient of newPatients) {
      const appointments = patient.appointments
      const hasUpcoming = appointments.some(a => new Date(a.scheduledAt) > now && a.status !== 'CANCELLED')
      const hasCompleted = appointments.some(a => a.status === 'COMPLETED')
      const totalSpent = appointments
        .filter(a => a.status === 'COMPLETED')
        .reduce((sum, a) => sum + (a.price || 0), 0)
      const lastAppointment = appointments[0]

      // Classificar o lead
      let targetStage = stageMap.novoContato
      let status: 'COLD' | 'WARM' | 'HOT' | 'WON' = 'WARM'
      let expectedValue = 0

      if (hasUpcoming) {
        targetStage = stageMap.agendamento
        status = 'HOT'
        expectedValue = appointments.find(a => new Date(a.scheduledAt) > now)?.price || 0
      } else if (hasCompleted && totalSpent > 0) {
        // Cliente que já gastou mas não tem agendamento futuro
        if (lastAppointment && (now.getTime() - new Date(lastAppointment.scheduledAt).getTime()) < 90 * 24 * 60 * 60 * 1000) {
          // Último atendimento < 90 dias atrás
          targetStage = stageMap.emAtendimento
          status = 'WARM'
          expectedValue = totalSpent / Math.max(appointments.filter(a => a.status === 'COMPLETED').length, 1)
        } else {
          // Cliente inativo > 90 dias
          targetStage = stageMap.novoContato
          status = 'COLD'
          expectedValue = totalSpent / Math.max(appointments.filter(a => a.status === 'COMPLETED').length, 1)
        }
      }

      // Calcular posição
      const stageKey = targetStage.id
      if (!stageCountUpdates[stageKey]) {
        stageCountUpdates[stageKey] = { count: 0, value: 0 }
      }
      stageCountUpdates[stageKey].count += 1
      stageCountUpdates[stageKey].value += expectedValue

      const position = (stageCountUpdates[stageKey].count) + (targetStage.cachedLeadCount || 0)

      // Determinar fonte
      let source = 'Sistema (importação)'
      if (patient.appointments.length > 0) {
        source = 'Paciente ativo'
      }

      // Tag anti-paradoxo: impede automações de topo de funil para pacientes já existentes
      // Sistemas de automação devem checar: if (lead.tags.includes('Importado')) → skip welcome flow
      const tags: string[] = ['Importado']

      // Tags baseadas no histórico do paciente
      if (totalSpent > 1000) tags.push('VIP')
      if (hasCompleted) tags.push('Recorrente')
      if (appointments.length > 3) tags.push('Fiel')

      // Tracking de classificação para o frontend
      if (status === 'HOT') classification.hot++
      else if (status === 'WARM') classification.warm++
      else classification.cold++
      if (tags.includes('VIP')) classification.vipCount++

      try {
        await prisma.lead.create({
          data: {
            tenantId: tenant.id,
            pipelineId: pipeline.id,
            stageId: targetStage.id,
            name: patient.name,
            phone: patient.phone || '',
            email: patient.email,
            status,
            position,
            expectedValue: expectedValue > 0 ? expectedValue : null,
            source,
            tags,
            patientId: patient.id,
            lastInteractionAt: lastAppointment ? new Date(lastAppointment.scheduledAt) : patient.createdAt,
          },
        })
        imported++
      } catch {
        // Skip duplicates silently
      }
    }

    // 7. Atualizar caches dos estágios
    for (const [stageId, updates] of Object.entries(stageCountUpdates)) {
      await prisma.stage.update({
        where: { id: stageId },
        data: {
          cachedLeadCount: { increment: updates.count },
          cachedTotalValue: { increment: updates.value },
          cacheUpdatedAt: new Date(),
        },
      })
    }

    // 8. Log de auditoria
    createAuditLog({
      tenantId: tenant.id,
      userId: payload.userId,
      action: CRM_ACTIONS.LEAD_CREATED,
      details: {
        type: 'bulk_import',
        imported,
        skipped: patients.length - newPatients.length,
        total: patients.length,
      },
    })

    return NextResponse.json({
      ok: true,
      imported,
      skipped: patients.length - newPatients.length,
      total: patients.length,
      classification,
      message: `${imported} pacientes importados e classificados`,
    })
  } catch (err) {
    console.error('[leads/import] POST error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno ao importar' }, { status: 500 })
  }
}
