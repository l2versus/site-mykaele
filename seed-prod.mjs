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

    console.log('=== Seed completo! ===');
}

main().catch(e => {
    console.error('Erro no seed:', e.message);
    // Não falhar o container por causa do seed
});
