// app/api/admin/crm/leads/[id]/convert/route.ts — Converter lead em paciente
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog, CRM_ACTIONS } from '@/lib/audit'
import bcrypt from 'bcryptjs'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await params

    const lead = await prisma.lead.findUnique({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        tenantId: true,
        patientId: true,
        status: true,
      },
    })

    if (!lead) {
      return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })
    }

    if (lead.patientId) {
      return NextResponse.json({ error: 'Lead já está vinculado a um paciente', patientId: lead.patientId }, { status: 409 })
    }

    // Buscar usuário existente por telefone ou email
    const cleanPhone = lead.phone.replace(/\D/g, '')
    let existingUser = null

    if (cleanPhone) {
      existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { phone: lead.phone },
            { phone: cleanPhone },
            // Formato com +55
            ...(cleanPhone.length === 11 ? [{ phone: `+55${cleanPhone}` }] : []),
            ...(cleanPhone.length === 13 && cleanPhone.startsWith('55') ? [{ phone: `+${cleanPhone}` }] : []),
          ],
        },
        select: { id: true, name: true, email: true, phone: true },
      })
    }

    if (!existingUser && lead.email) {
      existingUser = await prisma.user.findFirst({
        where: { email: lead.email },
        select: { id: true, name: true, email: true, phone: true },
      })
    }

    let patientId: string

    if (existingUser) {
      // Vincular lead ao usuário existente
      patientId = existingUser.id
    } else {
      // Criar novo usuário (role: PATIENT)
      // Gerar senha temporária (o paciente pode redefinir depois)
      const tempPassword = `myka${Date.now().toString(36)}`
      const hashedPassword = await bcrypt.hash(tempPassword, 10)

      const newUser = await prisma.user.create({
        data: {
          name: lead.name,
          email: lead.email ?? `lead_${lead.id}@placeholder.local`,
          phone: lead.phone,
          password: hashedPassword,
          role: 'PATIENT',
          forcePasswordChange: true,
        },
      })

      patientId = newUser.id
    }

    // Atualizar lead com patientId
    await prisma.lead.update({
      where: { id: lead.id },
      data: { patientId },
    })

    // Registrar atividade no lead
    await prisma.leadActivity.create({
      data: {
        leadId: lead.id,
        type: 'LEAD_CONVERTED',
        payload: {
          patientId,
          wasExisting: !!existingUser,
          patientName: existingUser?.name ?? lead.name,
        },
        createdBy: payload.userId,
      },
    })

    // Audit log (fire-and-forget)
    createAuditLog({
      tenantId: lead.tenantId,
      userId: payload.userId,
      action: CRM_ACTIONS.LEAD_CONVERTED,
      entityId: lead.id,
      details: { patientId, wasExisting: !!existingUser },
    })

    return NextResponse.json({
      ok: true,
      patientId,
      wasExisting: !!existingUser,
      patientName: existingUser?.name ?? lead.name,
    })
  } catch (err) {
    console.error('[lead convert] POST error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
