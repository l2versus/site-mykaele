#!/bin/sh
echo "=== Mykaele Home Spa - Inicializando ==="

# Criar banco de dados e tabelas se não existirem
echo ">> Criando tabelas do banco de dados..."
npx prisma db push --skip-generate 2>/dev/null || echo "Prisma db push falhou, tentando alternativa..."

# Rodar seed se o banco estiver vazio
echo ">> Verificando seed..."
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function seed() {
  try {
    const count = await prisma.user.count();
    if (count === 0) {
      console.log('Banco vazio, criando admin e serviços...');
      const bcrypt = require('bcryptjs');
      const hash = await bcrypt.hash('admin123', 10);
      await prisma.user.create({
        data: {
          email: 'admin@mykaele.com',
          password: hash,
          name: 'Mykaele Procópio',
          role: 'ADMIN',
          phone: '(85) 99908-6924'
        }
      });
      console.log('Admin criado: admin@mykaele.com / admin123');
      
      // Criar serviços
      const servicos = [
        { name: 'Limpeza de Pele', description: 'Limpeza profunda com extração e hidratação', price: 150, duration: 60, category: 'facial', active: true },
        { name: 'Peeling de Diamante', description: 'Esfoliação profunda para renovação celular', price: 180, duration: 45, category: 'facial', active: true },
        { name: 'Drenagem Linfática', description: 'Massagem para redução de inchaço e toxinas', price: 200, duration: 60, category: 'corporal', active: true },
        { name: 'Massagem Relaxante', description: 'Massagem completa para alívio do estresse', price: 180, duration: 60, category: 'corporal', active: true },
        { name: 'Radiofrequência Facial', description: 'Tratamento para firmeza e rejuvenescimento', price: 250, duration: 45, category: 'tecnologias', active: true },
        { name: 'Criolipólise', description: 'Redução de gordura localizada por congelamento', price: 350, duration: 50, category: 'tecnologias', active: true },
        { name: 'Design de Sobrancelhas', description: 'Modelagem profissional com henna', price: 80, duration: 30, category: 'facial', active: true },
        { name: 'Protocolo Anti-Acne', description: 'Tratamento completo para peles acneicas', price: 200, duration: 60, category: 'facial', active: true },
      ];
      
      for (const s of servicos) {
        await prisma.service.create({ data: s });
      }
      console.log(servicos.length + ' serviços criados!');
    } else {
      console.log('Banco já tem dados (' + count + ' usuários)');
    }
  } catch(e) {
    console.log('Erro no seed:', e.message);
  } finally {
    await prisma.\$disconnect();
  }
}
seed();
" 2>/dev/null || echo "Seed alternativo não disponível"

echo "=== Iniciando servidor Next.js ==="
exec node server.js
