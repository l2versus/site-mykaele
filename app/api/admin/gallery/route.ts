import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { writeFile, unlink, mkdir } from 'fs/promises'
import path from 'path'
import { existsSync } from 'fs'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'gallery')
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']

function getAdmin(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const user = verifyToken(auth.substring(7))
  return user?.role === 'ADMIN' ? user : null
}

// ═══ GET — Listar imagens da galeria ═══
export async function GET(req: NextRequest) {
  const admin = getAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const images = await prisma.galleryImage.findMany({
      orderBy: { order: 'asc' },
    })
    return NextResponse.json({ images })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar galeria' }, { status: 500 })
  }
}

// ═══ POST — Upload de nova imagem ═══
export async function POST(req: NextRequest) {
  const admin = getAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const alt = (formData.get('alt') as string) || ''

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Formato não permitido. Use JPEG, PNG, WebP ou AVIF.' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Arquivo muito grande. Máximo 5 MB.' }, { status: 400 })
    }

    // Garantir que a pasta existe
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true })
    }

    // Gerar nome seguro com timestamp
    const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
    const safeName = `gallery-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`
    const filePath = path.join(UPLOAD_DIR, safeName)

    // Salvar arquivo
    const bytes = await file.arrayBuffer()
    await writeFile(filePath, Buffer.from(bytes))

    // Próxima ordem
    const maxOrder = await prisma.galleryImage.aggregate({ _max: { order: true } })
    const nextOrder = (maxOrder._max.order ?? -1) + 1

    const image = await prisma.galleryImage.create({
      data: {
        url: `/uploads/gallery/${safeName}`,
        alt: alt || null,
        order: nextOrder,
      },
    })

    return NextResponse.json({ image }, { status: 201 })
  } catch (error) {
    console.error('Erro no upload da galeria:', error)
    return NextResponse.json({ error: 'Erro ao fazer upload' }, { status: 500 })
  }
}

// ═══ PUT — Reordenar imagens ═══
export async function PUT(req: NextRequest) {
  const admin = getAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const { orderedIds } = await req.json()
    if (!Array.isArray(orderedIds)) {
      return NextResponse.json({ error: 'orderedIds deve ser um array' }, { status: 400 })
    }

    await Promise.all(
      orderedIds.map((id: string, index: number) =>
        prisma.galleryImage.update({ where: { id }, data: { order: index } })
      )
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao reordenar' }, { status: 500 })
  }
}

// ═══ DELETE — Excluir imagem ═══
export async function DELETE(req: NextRequest) {
  const admin = getAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

    const image = await prisma.galleryImage.findUnique({ where: { id } })
    if (!image) return NextResponse.json({ error: 'Imagem não encontrada' }, { status: 404 })

    // Deletar arquivo físico
    const filePath = path.join(process.cwd(), 'public', image.url)
    try { await unlink(filePath) } catch { /* arquivo já pode não existir */ }

    await prisma.galleryImage.delete({ where: { id } })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao excluir imagem' }, { status: 500 })
  }
}
