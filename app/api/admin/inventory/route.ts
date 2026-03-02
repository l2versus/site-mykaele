import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

function getAdmin(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const user = verifyToken(auth.substring(7))
  return user?.role === 'ADMIN' ? user : null
}

// GET — Listar todos os itens de estoque (com filtros)
export async function GET(req: NextRequest) {
  const admin = getAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')
    const lowStock = searchParams.get('lowStock') === 'true'
    const includeMovements = searchParams.get('movements') === 'true'

    const where: Record<string, unknown> = { active: true }
    if (category) where.category = category

    const items = await prisma.inventoryItem.findMany({
      where,
      include: includeMovements ? {
        movements: { orderBy: { createdAt: 'desc' }, take: 20 }
      } : undefined,
      orderBy: { name: 'asc' },
    })

    // Filtrar estoque baixo se solicitado
    const result = lowStock
      ? items.filter(i => i.quantity <= i.minQuantity)
      : items

    // Calcular resumo
    const summary = {
      totalItems: items.length,
      lowStockCount: items.filter(i => i.quantity <= i.minQuantity).length,
      outOfStockCount: items.filter(i => i.quantity <= 0).length,
      totalValue: items.reduce((sum, i) => sum + (i.quantity * i.costPerUnit), 0),
    }

    return NextResponse.json({ items: result, summary })
  } catch (error) {
    console.error('Inventory GET error:', error)
    return NextResponse.json({ error: 'Erro ao buscar estoque' }, { status: 500 })
  }
}

// POST — Criar item ou registrar movimentação
export async function POST(req: NextRequest) {
  const admin = getAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const body = await req.json()
    const { action } = body

    // ── Registrar Movimentação (entrada/saída/ajuste) ──
    if (action === 'movement') {
      const { itemId, type, quantity, reason, cost } = body

      if (!itemId || !type || quantity === undefined) {
        return NextResponse.json({ error: 'itemId, type e quantity são obrigatórios' }, { status: 400 })
      }

      const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } })
      if (!item) return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 })

      const qtyChange = type === 'OUT' ? -Math.abs(quantity) : Math.abs(quantity)
      const newQty = Math.max(0, item.quantity + qtyChange)

      // Criar movimentação
      let expenseId: string | null = null

      // Se é entrada (compra), criar despesa automaticamente
      if (type === 'IN' && cost && cost > 0) {
        const expense = await prisma.expense.create({
          data: {
            description: `Compra: ${item.name} (${Math.abs(quantity)} ${item.unit})`,
            amount: parseFloat(String(cost)),
            category: 'MATERIAL',
            date: new Date(),
          },
        })
        expenseId = expense.id
      }

      const movement = await prisma.stockMovement.create({
        data: {
          inventoryItemId: itemId,
          type,
          quantity: qtyChange,
          reason: reason || (type === 'IN' ? 'Compra/Reposição' : type === 'OUT' ? 'Uso em sessão' : 'Ajuste'),
          cost: cost ? parseFloat(String(cost)) : null,
          expenseId,
        },
      })

      // Atualizar quantidade no item + custo médio se entrada
      const updateData: Record<string, unknown> = { quantity: newQty }
      if (type === 'IN' && cost && quantity > 0) {
        updateData.costPerUnit = parseFloat(String(cost)) / Math.abs(quantity)
        updateData.lastOrderedAt = new Date()
      }

      const updatedItem = await prisma.inventoryItem.update({
        where: { id: itemId },
        data: updateData,
      })

      return NextResponse.json({
        movement,
        item: updatedItem,
        expenseCreated: !!expenseId,
      })
    }

    // ── Criar novo item ──
    const { name, description, category, unit, quantity, minQuantity, costPerUnit,
      supplierName, supplierPhone, supplierEmail, supplierNotes, autoOrderQty } = body

    if (!name) {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
    }

    const item = await prisma.inventoryItem.create({
      data: {
        name,
        description: description || null,
        category: category || 'MATERIAL',
        unit: unit || 'un',
        quantity: parseFloat(String(quantity || 0)),
        minQuantity: parseFloat(String(minQuantity || 5)),
        costPerUnit: parseFloat(String(costPerUnit || 0)),
        supplierName: supplierName || null,
        supplierPhone: supplierPhone || null,
        supplierEmail: supplierEmail || null,
        supplierNotes: supplierNotes || null,
        autoOrderQty: autoOrderQty ? parseFloat(String(autoOrderQty)) : null,
      },
    })

    return NextResponse.json({ item })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('Inventory POST error:', msg)
    if (msg.includes('Unique constraint')) {
      return NextResponse.json({ error: 'Já existe um item com esse nome' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Erro ao salvar' }, { status: 500 })
  }
}

// PATCH — Atualizar item
export async function PATCH(req: NextRequest) {
  const admin = getAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

    const body = await req.json()
    const data: Record<string, unknown> = {}

    if (body.name !== undefined) data.name = body.name
    if (body.description !== undefined) data.description = body.description
    if (body.category !== undefined) data.category = body.category
    if (body.unit !== undefined) data.unit = body.unit
    if (body.quantity !== undefined) data.quantity = parseFloat(String(body.quantity))
    if (body.minQuantity !== undefined) data.minQuantity = parseFloat(String(body.minQuantity))
    if (body.costPerUnit !== undefined) data.costPerUnit = parseFloat(String(body.costPerUnit))
    if (body.active !== undefined) data.active = body.active
    if (body.supplierName !== undefined) data.supplierName = body.supplierName || null
    if (body.supplierPhone !== undefined) data.supplierPhone = body.supplierPhone || null
    if (body.supplierEmail !== undefined) data.supplierEmail = body.supplierEmail || null
    if (body.supplierNotes !== undefined) data.supplierNotes = body.supplierNotes || null
    if (body.autoOrderQty !== undefined) data.autoOrderQty = body.autoOrderQty ? parseFloat(String(body.autoOrderQty)) : null

    const item = await prisma.inventoryItem.update({ where: { id }, data })
    return NextResponse.json({ item })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('Inventory PATCH error:', msg)
    if (msg.includes('Unique constraint')) {
      return NextResponse.json({ error: 'Já existe um item com esse nome' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Erro ao atualizar' }, { status: 500 })
  }
}

// DELETE — Desativar ou remover item
export async function DELETE(req: NextRequest) {
  const admin = getAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

    // Soft delete (desativar)
    await prisma.inventoryItem.update({
      where: { id },
      data: { active: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Inventory DELETE error:', error)
    return NextResponse.json({ error: 'Erro ao remover' }, { status: 500 })
  }
}
