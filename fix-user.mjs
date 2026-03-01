import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import bcrypt from 'bcryptjs'

const adapter = new PrismaLibSql({ url: 'file:./dev.db' })
const prisma = new PrismaClient({ adapter })

async function main() {
    // Buscar usuário
    const user = await prisma.user.findUnique({
        where: { email: 'emmanuelbezerra1992@gmail.com' }
    })

    if (!user) {
        console.log('❌ Usuário não encontrado!')

        // Criar novo
        const hashedPassword = await bcrypt.hash('teste123', 10)
        const newUser = await prisma.user.create({
            data: {
                email: 'emmanuelbezerra1992@gmail.com',
                password: hashedPassword,
                name: 'Emmanuel Bezerra',
                phone: '85998500344',
                role: 'PATIENT',
            }
        })
        console.log('✅ Usuário criado:', newUser.id)
    } else {
        console.log('✅ Usuário existe:', user.id, user.name)

        // Atualizar senha para garantir
        const hashedPassword = await bcrypt.hash('teste123', 10)
        await prisma.user.update({
            where: { id: user.id },
            data: { password: hashedPassword }
        })
        console.log('✅ Senha atualizada!')
    }

    console.log('')
    console.log('📋 LOGIN:')
    console.log('   Email: emmanuelbezerra1992@gmail.com')
    console.log('   Senha: teste123')

    await prisma.$disconnect()
}

main().catch(console.error)
