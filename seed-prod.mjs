#!/usr/bin/env node
// seed-prod.mjs — Seed de produção para Mykaele Home Spa
// Usa @libsql/client diretamente (disponível no standalone)

async function main() {
  const { createClient } = await import('@libsql/client');
  const bcrypt = await import('./node_modules/bcryptjs/index.js');

  const dbUrl = process.env.DATABASE_URL || 'file:/app/data/mykaele.db';
  const client = createClient({ url: dbUrl });

  // Verificar se admin já existe
  try {
    const result = await client.execute('SELECT COUNT(*) as count FROM "User"');
    const count = Number(result.rows[0].count);
    if (count > 0) {
      console.log(`Banco já tem ${count} usuário(s). Seed não necessário.`);
      return;
    }
  } catch (e) {
    console.log('Tabela User não encontrada ou erro:', e.message);
    return;
  }

  const now = new Date().toISOString();
  const hash = bcrypt.default ? bcrypt.default.hashSync('admin123', 10) : bcrypt.hashSync('admin123', 10);

  // Criar admin
  await client.execute({
    sql: `INSERT INTO "User" ("id", "email", "password", "name", "role", "phone", "balance", "createdAt", "updatedAt")
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: ['admin-myka-001', 'admin@mykaele.com', hash, 'Mykaele Procópio', 'ADMIN', '(85) 99908-6924', 0, now, now]
  });
  console.log('Admin criado: admin@mykaele.com / admin123');

  // Criar serviços
  const servicos = [
    { id: 'svc-001', name: 'Limpeza de Pele', description: 'Limpeza profunda com extração e hidratação', price: 150, duration: 60, category: 'facial' },
    { id: 'svc-002', name: 'Peeling de Diamante', description: 'Esfoliação profunda para renovação celular', price: 180, duration: 45, category: 'facial' },
    { id: 'svc-003', name: 'Drenagem Linfática', description: 'Massagem para redução de inchaço e toxinas', price: 200, duration: 60, category: 'corporal' },
    { id: 'svc-004', name: 'Massagem Relaxante', description: 'Massagem completa para alívio do estresse', price: 180, duration: 60, category: 'corporal' },
    { id: 'svc-005', name: 'Radiofrequência Facial', description: 'Tratamento para firmeza e rejuvenescimento', price: 250, duration: 45, category: 'tecnologias' },
    { id: 'svc-006', name: 'Criolipólise', description: 'Redução de gordura localizada por congelamento', price: 350, duration: 50, category: 'tecnologias' },
    { id: 'svc-007', name: 'Design de Sobrancelhas', description: 'Modelagem profissional com henna', price: 80, duration: 30, category: 'facial' },
    { id: 'svc-008', name: 'Protocolo Anti-Acne', description: 'Tratamento completo para peles acneicas', price: 200, duration: 60, category: 'facial' },
  ];

  for (const s of servicos) {
    await client.execute({
      sql: `INSERT OR IGNORE INTO "Service" ("id", "name", "description", "price", "duration", "active", "isAddon", "createdAt", "updatedAt")
            VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?)`,
      args: [s.id, s.name, s.description, s.price, s.duration, now, now]
    });
  }
  console.log(`${servicos.length} serviços criados!`);

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
