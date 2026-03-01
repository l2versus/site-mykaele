import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

function getUser(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  return verifyToken(auth.substring(7))
}

export async function GET(req: NextRequest) {
  const user = getUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const profile = await prisma.user.findUnique({
      where: { id: user.userId },
      select: {
        id: true, name: true, email: true, phone: true, cpfRg: true,
        address: true, addressCep: true, addressStreet: true, addressNumber: true,
        addressComp: true, addressNeighborhood: true, addressCity: true,
        addressState: true, addressLat: true, addressLng: true,
        avatar: true, createdAt: true, forcePasswordChange: true,
      },
    })
    if (!profile) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    return NextResponse.json({ profile })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar perfil' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const user = getUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const contentType = req.headers.get('content-type') || ''

    // Handle multipart form upload (avatar)
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const file = formData.get('avatar') as File | null
      if (!file) return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })

      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)

      // Ensure directory exists
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'avatars')
      await mkdir(uploadDir, { recursive: true })

      // Save file
      const ext = file.name.split('.').pop() || 'jpg'
      const filename = `${user.userId}-${Date.now()}.${ext}`
      const filepath = path.join(uploadDir, filename)
      await writeFile(filepath, buffer)

      const avatarUrl = `/uploads/avatars/${filename}`

      const profile = await prisma.user.update({
        where: { id: user.userId },
        data: { avatar: avatarUrl },
        select: { id: true, name: true, email: true, phone: true, cpfRg: true, address: true, avatar: true },
      })
      return NextResponse.json({ profile })
    }

    // Handle JSON update (name, phone, cpfRg, address + structured fields)
    const body = await req.json()
    const { name, phone, cpfRg, address,
      addressCep, addressStreet, addressNumber, addressComp,
      addressNeighborhood, addressCity, addressState,
      addressLat, addressLng,
    } = body
    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name
    if (phone !== undefined) data.phone = phone
    if (cpfRg !== undefined) data.cpfRg = cpfRg
    if (address !== undefined) data.address = address
    if (addressCep !== undefined) data.addressCep = addressCep
    if (addressStreet !== undefined) data.addressStreet = addressStreet
    if (addressNumber !== undefined) data.addressNumber = addressNumber
    if (addressComp !== undefined) data.addressComp = addressComp
    if (addressNeighborhood !== undefined) data.addressNeighborhood = addressNeighborhood
    if (addressCity !== undefined) data.addressCity = addressCity
    if (addressState !== undefined) data.addressState = addressState
    if (addressLat !== undefined) data.addressLat = addressLat !== null ? parseFloat(addressLat) : null
    if (addressLng !== undefined) data.addressLng = addressLng !== null ? parseFloat(addressLng) : null

    const profile = await prisma.user.update({
      where: { id: user.userId },
      data,
      select: {
        id: true, name: true, email: true, phone: true, cpfRg: true,
        address: true, addressCep: true, addressStreet: true, addressNumber: true,
        addressComp: true, addressNeighborhood: true, addressCity: true,
        addressState: true, addressLat: true, addressLng: true, avatar: true,
      },
    })
    return NextResponse.json({ profile })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao atualizar perfil' }, { status: 500 })
  }
}
