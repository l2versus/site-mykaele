// seed-services.mjs
import Database from 'better-sqlite3'

const db = new Database('./dev.db')

const now = new Date().toISOString()
const services = [
    {
        id: 'svc_001',
        name: 'Arquitetura Corporal',
        description: 'Modelagem e escultura do corpo com técnicas avançadas de lifting',
        duration: 90,
        price: 350,
        priceReturn: 280,
        active: true,
        isAddon: false,
        travelFee: null,
        createdAt: now,
    },
    {
        id: 'svc_002',
        name: 'Limpeza de Pele',
        description: 'Limpeza profunda com extração de impurezas e hidratação',
        duration: 60,
        price: 180,
        priceReturn: 140,
        active: true,
        isAddon: false,
        travelFee: null,
        createdAt: now,
    },
    {
        id: 'svc_003',
        name: 'Drenagem Linfática',
        description: 'Estimulação manual do sistema linfático para eliminação de toxinas',
        duration: 60,
        price: 220,
        priceReturn: 170,
        active: true,
        isAddon: false,
        travelFee: null,
        createdAt: now,
    },
    {
        id: 'svc_004',
        name: 'Massagem Relaxante',
        description: 'Massagem terapêutica para alívio de tensões musculares',
        duration: 60,
        price: 200,
        priceReturn: 160,
        active: true,
        isAddon: false,
        travelFee: null,
        createdAt: now,
    },
    {
        id: 'svc_005',
        name: 'Peeling Químico',
        description: 'Renovação celular profunda para rejuvenescimento da pele',
        duration: 45,
        price: 250,
        priceReturn: 200,
        active: true,
        isAddon: false,
        travelFee: null,
        createdAt: now,
    },
    {
        id: 'svc_addon_001',
        name: 'Hidratação Extra',
        description: 'Hidratação intensiva complementar',
        duration: 15,
        price: 50,
        priceReturn: null,
        active: true,
        isAddon: true,
        travelFee: null,
        createdAt: now,
    },
]

try {
    // Deletar serviços existentes
    db.exec('DELETE FROM "Service"')

    for (const svc of services) {
        db.prepare(`
      INSERT INTO "Service" (id, name, description, duration, price, priceReturn, active, isAddon, travelFee, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            svc.id,
            svc.name,
            svc.description,
            svc.duration,
            svc.price,
            svc.priceReturn,
            svc.active ? 1 : 0,
            svc.isAddon ? 1 : 0,
            svc.travelFee,
            svc.createdAt,
            svc.createdAt
        )
    }

    console.log(`✅ ${services.length} serviços criados com sucesso!`)
} catch (err) {
    console.error('❌ Erro:', err.message)
} finally {
    db.close()
}
