import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const { Pool } = pg

// Configura a conexão nativa com a URL do seu .env
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
})

// Cria o adaptador do Prisma 7
const adapter = new PrismaPg(pool)

// Função que cria o cliente já com o adaptador
const prismaClientSingleton = () => {
  return new PrismaClient({ adapter })
}

// Previne múltiplas conexões abertas no modo de desenvolvimento (Hot Reload)
declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma