import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const { Pool } = pg

// 1. Criamos a conexão nativa com a URL que agora está segura no .env
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
})

// 2. Criamos o adaptador do Prisma 7
const adapter = new PrismaPg(pool)

// 3. Passamos o adaptador para o cliente (Isso resolve o erro!)
const prisma = new PrismaClient({ adapter })

async function main() {
    console.log('Conectando ao banco de dados no Coolify...')

    const novoUsuario = await prisma.user.create({
        data: {
            name: 'Cliente de Teste',
            email: 'teste@exemplo.com',
            password: 'senha123',
            role: 'PATIENT'
        }
    })

    console.log('Sucesso! 🎉 Usuário criado no banco:')
    console.log(novoUsuario)
}

main()
    .catch((erro) => {
        console.error('Ops, deu erro:', erro)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })