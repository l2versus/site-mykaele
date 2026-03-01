// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

const prismaClientSingleton = () => {
  const dbUrl = process.env.DATABASE_URL || (process.env.NODE_ENV === 'production' ? 'file:/app/data/mykaele.db' : 'file:./dev.db')
  const adapter = new PrismaLibSql({ url: dbUrl })
  return new PrismaClient({ adapter })
}

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined
}

export const prisma = globalForPrisma.prisma ?? prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
