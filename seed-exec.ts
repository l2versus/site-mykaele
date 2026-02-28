import pkg from '@prisma/client'
import bcrypt from 'bcryptjs'

const { PrismaClient } = pkg
const prisma = new PrismaClient()

async function main() {
    console.log('🌱 Seeding...')

    // Admin
    const adminPass = bcrypt.hashSync('admin123', 10)
    const admin = await prisma.user.create({ 
        data: { 
            email: 'mykaele@homespa.com', 
            password: adminPass, 
            name: 'Mykaele Procópio', 
            phone: '(85) 99908-6924', 
            role: 'ADMIN' 
        } 
    })
    console.log('✅ Admin criado: mykaele@homespa.com / admin123')

    // Demo patient
    const patientPass = bcrypt.hashSync('cliente123', 10)
    const patient = await prisma.user.create({ 
        data: { 
            email: 'cliente@demo.com', 
            password: patientPass, 
            name: 'Cliente Demo', 
            phone: '(85) 98888-0000', 
            role: 'PATIENT', 
            balance: 0 
        } 
    })
    console.log('✅ Cliente demo criado')

    console.log('✅ Seed concluído com sucesso!')
    console.log('\n📝 Credenciais de teste:')
    console.log('   Email: mykaele@homespa.com')
    console.log('   Senha: admin123')
}

main()
    .then(() => {
        prisma.$disconnect()
        process.exit(0)
    })
    .catch((e) => {
        console.error(e)
        prisma.$disconnect()
        process.exit(1)
    })

