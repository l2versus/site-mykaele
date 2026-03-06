// app/api/admin/settings/route.ts — CMS: SiteSettings (whatsapp, heroTitle, aboutText)
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

function getAdmin(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const user = verifyToken(auth.substring(7))
  return user?.role === 'ADMIN' ? user : null
}

const SINGLETON_ID = 'site-settings-singleton'

// ═══ GET — Retorna configurações do site ═══
export async function GET(req: NextRequest) {
  try {
    // GET público (para o site consumir) ou admin
    let settings = await prisma.siteSettings.findUnique({ where: { id: SINGLETON_ID } })

    if (!settings) {
      // Cria registro padrão se não existir
      settings = await prisma.siteSettings.create({
        data: {
          id: SINGLETON_ID,
          whatsapp: '(85) 99908-6924',
          heroTitle: 'Mykaele Procópio Home Spa',
          aboutText: '',
        },
      })
    }

    return NextResponse.json({ settings })
  } catch (error) {
    console.error('Settings GET error:', error)
    return NextResponse.json({ error: 'Erro ao buscar configurações' }, { status: 500 })
  }
}

// ═══ PUT — Atualiza configurações do site (admin only) ═══
export async function PUT(req: NextRequest) {
  const admin = getAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const body = await req.json()
    const { whatsapp, heroTitle, aboutText } = body

    const settings = await prisma.siteSettings.upsert({
      where: { id: SINGLETON_ID },
      create: {
        id: SINGLETON_ID,
        whatsapp: whatsapp || '',
        heroTitle: heroTitle || '',
        aboutText: aboutText || '',
      },
      update: {
        ...(whatsapp !== undefined && { whatsapp }),
        ...(heroTitle !== undefined && { heroTitle }),
        ...(aboutText !== undefined && { aboutText }),
      },
    })

    // Invalida cache do Next.js para que a página principal reflita as mudanças
    revalidatePath('/')

    return NextResponse.json({ settings, message: 'Configurações atualizadas' })
  } catch (error) {
    console.error('Settings PUT error:', error)
    return NextResponse.json({ error: 'Erro ao salvar configurações' }, { status: 500 })
  }
}
