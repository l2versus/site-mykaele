// seed-admins.mjs — Atualiza/cria admins no SQLite (produção Coolify)
// Usa @libsql/client (mesmo driver do seed-prod.mjs)
// Rodado automaticamente pelo start.sh em cada deploy

async function main() {
    const { createClient } = await import('@libsql/client');
    const bcrypt = await import('./node_modules/bcryptjs/index.js');
    const hash = bcrypt.default ? bcrypt.default.hashSync.bind(bcrypt.default) : bcrypt.hashSync;

    const dbUrl = process.env.DATABASE_URL || 'file:/app/data/mykaele.db';
    const client = createClient({ url: dbUrl });

    const now = new Date().toISOString();

    // 1. Atualizar senha admin existente → @Luna1997_
    const adminHash = hash('@Luna1997_', 10);
    const res1 = await client.execute({
        sql: `UPDATE "User" SET password = ?, "updatedAt" = ? WHERE email = ?`,
        args: [adminHash, now, 'admin@mykaele.com']
    });
    console.log(res1.rowsAffected > 0
        ? '✅ Senha atualizada: admin@mykaele.com'
        : '⚠️ admin@mykaele.com não encontrado — será criado pelo seed-prod');

    // 2. Criar/atualizar dev admin → eb@dev.com.br / @Luna1992_
    const devHash = hash('@Luna1992_', 10);
    // Verificar se já existe
    const existing = await client.execute({
        sql: `SELECT id FROM "User" WHERE email = ?`,
        args: ['eb@dev.com.br']
    });

    if (existing.rows.length > 0) {
        await client.execute({
            sql: `UPDATE "User" SET password = ?, role = 'ADMIN', name = 'Emmanuel Bezerra', "updatedAt" = ? WHERE email = ?`,
            args: [devHash, now, 'eb@dev.com.br']
        });
        console.log('✅ Dev admin atualizado: eb@dev.com.br');
    } else {
        await client.execute({
            sql: `INSERT INTO "User" ("id", "email", "password", "name", "role", "phone", "balance", "forcePasswordChange", "createdAt", "updatedAt")
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: ['dev-emmanuel-001', 'eb@dev.com.br', devHash, 'Emmanuel Bezerra', 'ADMIN', '', 0, 0, now, now]
        });
        console.log('✅ Dev admin criado: eb@dev.com.br');
    }

    // Listar admins
    const admins = await client.execute(`SELECT email, name, role FROM "User" WHERE role = 'ADMIN'`);
    console.log('\n📋 Admins no sistema:');
    for (const a of admins.rows) {
        console.log(`   • ${a.email} — ${a.name}`);
    }

    console.log('\n🎉 Admins configurados!');
}

main().catch(e => {
    console.error('❌ Erro seed-admins:', e.message);
    // Não falhar o container
});
