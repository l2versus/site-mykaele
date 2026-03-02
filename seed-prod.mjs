#!/usr/bin/env node
// seed-prod.mjs — Seed de produção para Mykaele Home Spa
// Usa @libsql/client diretamente (disponível no standalone)

async function main() {
    const { createClient } = await import('@libsql/client');
    const bcrypt = await import('./node_modules/bcryptjs/index.js');

    const dbUrl = process.env.DATABASE_URL || 'file:/app/data/mykaele.db';
    const client = createClient({ url: dbUrl });

    const now = new Date().toISOString();

    // Verificar se admin já existe
    let adminExists = false;
    try {
        const result = await client.execute('SELECT COUNT(*) as count FROM "User" WHERE role = \'ADMIN\'');
        adminExists = Number(result.rows[0].count) > 0;
    } catch (e) {
        console.log('Tabela User não encontrada ou erro:', e.message);
        return;
    }

    if (!adminExists) {
        const hash = bcrypt.default ? bcrypt.default.hashSync('admin123', 10) : bcrypt.hashSync('admin123', 10);
        await client.execute({
            sql: `INSERT INTO "User" ("id", "email", "password", "name", "role", "phone", "balance", "createdAt", "updatedAt")
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: ['admin-myka-001', 'admin@mykaele.com', hash, 'Mykaele Procópio', 'ADMIN', '(85) 99908-6924', 0, now, now]
        });
        console.log('Admin criado: admin@mykaele.com / admin123');
    } else {
        console.log('Admin já existe, pulando criação.');
    }

    // Limpar serviços e pacotes antigos para garantir dados atualizados
    await client.execute('DELETE FROM "PackageOption"');
    await client.execute('DELETE FROM "Service"');
    console.log('Serviços antigos removidos.');

    // Criar serviços
    const servicos = [
        { id: 'svc-001', name: 'Método Mykaele Procópio', description: 'Protocolo exclusivo de remodelação corporal de alta performance. Resultados visíveis desde a primeira sessão.', price: 330, priceReturn: 330, duration: 90, isAddon: 0, travelFee: 'Taxa de deslocamento conforme distância' },
        { id: 'svc-002', name: 'Massagem Relaxante', description: 'Massagem terapêutica de relaxamento profundo para alívio de tensões e bem-estar completo.', price: 280, priceReturn: 280, duration: 90, isAddon: 0, travelFee: 'Taxa de deslocamento conforme distância' },
        { id: 'svc-003', name: 'Manta Térmica (Adicional)', description: 'Potencialize seu tratamento com 30 minutos de manta térmica para resultados intensificados.', price: 80, priceReturn: 80, duration: 30, isAddon: 1, travelFee: null },
    ];

    for (const s of servicos) {
        await client.execute({
            sql: `INSERT INTO "Service" ("id", "name", "description", "price", "priceReturn", "duration", "active", "isAddon", "travelFee", "createdAt", "updatedAt")
            VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
            args: [s.id, s.name, s.description, s.price, s.priceReturn, s.duration, s.isAddon, s.travelFee, now, now]
        });
    }
    console.log(`${servicos.length} serviços criados!`);

    // Criar opções de pacote
    const pacotes = [
        { id: 'pkg-001', serviceId: 'svc-001', name: 'Pacote 5 sessões', sessions: 5, price: 1500 },
        { id: 'pkg-002', serviceId: 'svc-001', name: 'Pacote 10 sessões', sessions: 10, price: 2800 },
        { id: 'pkg-003', serviceId: 'svc-002', name: 'Pacote 5 sessões', sessions: 5, price: 1300 },
        { id: 'pkg-004', serviceId: 'svc-002', name: 'Pacote 10 sessões', sessions: 10, price: 2500 },
    ];

    for (const p of pacotes) {
        await client.execute({
            sql: `INSERT INTO "PackageOption" ("id", "serviceId", "name", "sessions", "price", "active", "createdAt", "updatedAt")
            VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
            args: [p.id, p.serviceId, p.name, p.sessions, p.price, now, now]
        });
    }
    console.log(`${pacotes.length} opções de pacote criadas!`);

    // Criar horários padrão (seg-sáb)
    const schedules = [
        { id: 'sch-1', day: 1, start: '08:00', end: '18:00' },
        { id: 'sch-2', day: 2, start: '08:00', end: '18:00' },
        { id: 'sch-3', day: 3, start: '08:00', end: '18:00' },
        { id: 'sch-4', day: 4, start: '08:00', end: '18:00' },
        { id: 'sch-5', day: 5, start: '08:00', end: '18:00' },
        { id: 'sch-6', day: 6, start: '08:00', end: '13:00' },
    ];

    for (const sch of schedules) {
        await client.execute({
            sql: `INSERT OR IGNORE INTO "Schedule" ("id", "dayOfWeek", "startTime", "endTime", "slotDuration", "active")
            VALUES (?, ?, ?, ?, 60, 1)`,
            args: [sch.id, sch.day, sch.start, sch.end]
        });
    }
    console.log('Horários de atendimento configurados!');

    // Criar recompensas do programa de fidelidade
    const rewards = [
        { id: 'rwd-001', name: 'Desconto de R$30', description: 'Válido para qualquer sessão avulsa', pointsCost: 300, type: 'DISCOUNT', value: 30, imageEmoji: '💰' },
        { id: 'rwd-002', name: 'Desconto de R$50', description: 'Válido para qualquer sessão avulsa', pointsCost: 500, type: 'DISCOUNT', value: 50, imageEmoji: '💎' },
        { id: 'rwd-003', name: 'Desconto de R$100', description: 'Válido para qualquer serviço ou pacote', pointsCost: 900, type: 'DISCOUNT', value: 100, imageEmoji: '🌟' },
        { id: 'rwd-004', name: 'Manta Térmica Grátis', description: 'Add-on de Manta Térmica (30min) grátis na próxima sessão', pointsCost: 400, type: 'FREE_ADDON', value: 80, imageEmoji: '🔥' },
        { id: 'rwd-005', name: 'Massagem Relaxante Grátis', description: 'Uma sessão completa de Massagem Relaxante (90min)', pointsCost: 1400, type: 'FREE_SESSION', value: 280, imageEmoji: '💆' },
        { id: 'rwd-006', name: 'Método Mykaele Procópio Grátis', description: 'Uma sessão completa do Método exclusivo (90min)', pointsCost: 1650, type: 'FREE_SESSION', value: 330, imageEmoji: '👑' },
        { id: 'rwd-007', name: 'Upgrade para Método Premium', description: 'Transforme qualquer sessão em Método Mykaele Procópio', pointsCost: 600, type: 'UPGRADE', value: 120, imageEmoji: '✨' },
    ];

    for (const r of rewards) {
        try {
            await client.execute({
                sql: `INSERT OR IGNORE INTO "LoyaltyReward" ("id", "name", "description", "pointsCost", "type", "value", "active", "imageEmoji", "createdAt", "updatedAt")
                VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
                args: [r.id, r.name, r.description, r.pointsCost, r.type, r.value, r.imageEmoji, now, now]
            });
        } catch (e) {
            // Tabela pode não existir em bancos muito antigos
        }
    }
    console.log(`${rewards.length} recompensas de fidelidade configuradas!`);

    // ─── Seed Estoque Inicial ───
    const inventoryItems = [
        { id: 'inv-001', name: 'Chá de Hibisco', description: 'Chá oferecido às pacientes durante a sessão', category: 'MATERIAL', unit: 'cx', quantity: 10, minQuantity: 3, costPerUnit: 12.90, supplierName: null, supplierPhone: null },
        { id: 'inv-002', name: 'Foto Impressa', description: 'Foto antes/depois impressa para registro da paciente', category: 'DESCARTAVEL', unit: 'un', quantity: 50, minQuantity: 10, costPerUnit: 1.50, supplierName: null, supplierPhone: null },
        { id: 'inv-003', name: 'Kest Comprimido', description: 'Comprimido utilizado em protocolo corporal', category: 'COSMETICO', unit: 'cx', quantity: 5, minQuantity: 2, costPerUnit: 45.00, supplierName: null, supplierPhone: null },
        { id: 'inv-004', name: 'Creme Modelador', description: 'Creme de massagem modeladora profissional', category: 'COSMETICO', unit: 'un', quantity: 8, minQuantity: 3, costPerUnit: 65.00, supplierName: null, supplierPhone: null },
    ];

    for (const item of inventoryItems) {
        try {
            await client.execute({
                sql: `INSERT OR IGNORE INTO "InventoryItem" ("id", "name", "description", "category", "unit", "quantity", "minQuantity", "costPerUnit", "active", "supplierName", "supplierPhone", "supplierEmail", "supplierNotes", "autoOrderQty", "lastOrderedAt", "createdAt", "updatedAt")
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, NULL, NULL, NULL, NULL, ?, ?)`,
                args: [item.id, item.name, item.description, item.category, item.unit, item.quantity, item.minQuantity, item.costPerUnit, item.supplierName, item.supplierPhone, now, now]
            });
        } catch (e) {
            // Tabela pode não existir em deploys mais antigos
        }
    }
    console.log(`${inventoryItems.length} itens de estoque iniciais configurados!`);

    console.log('=== Seed completo! ===');
}

main().catch(e => {
    console.error('Erro no seed:', e.message);
    // Não falhar o container por causa do seed
});
