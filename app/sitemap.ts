import type { MetadataRoute } from 'next'
import { PrismaClient } from '@prisma/client'

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://mykaprocopio.com.br'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Páginas estáticas
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/galeria-resultados`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/cliente`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/cliente/agendar`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/cliente/pacotes`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
  ]

  // Páginas dinâmicas de serviços (se existirem rotas individuais no futuro)
  let servicePages: MetadataRoute.Sitemap = []
  try {
    const prisma = new PrismaClient()
    const services = await prisma.service.findMany({
      where: { active: true },
      select: { id: true, updatedAt: true },
    })
    await prisma.$disconnect()
    
    // Preparado para quando houver rotas individuais de serviço
    // servicePages = services.map((s) => ({
    //   url: `${SITE_URL}/servicos/${s.id}`,
    //   lastModified: s.updatedAt,
    //   changeFrequency: 'monthly' as const,
    //   priority: 0.6,
    // }))
  } catch {
    // Silently ignore DB errors in sitemap generation
  }

  return [...staticPages, ...servicePages]
}
