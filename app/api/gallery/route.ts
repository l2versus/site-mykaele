import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// ═══ GET — Galeria pública (sem autenticação) ═══
export async function GET() {
  try {
    const images = await prisma.galleryImage.findMany({
      orderBy: { order: 'asc' },
      select: { id: true, url: true, alt: true, order: true },
    })
    return NextResponse.json({ images })
  } catch (error) {
    return NextResponse.json({ images: [] })
  }
}
