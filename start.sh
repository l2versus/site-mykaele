#!/bin/sh
echo "=== Mykaele Home Spa - Inicializando ==="

DB_PATH="/app/data/mykaele.db"

# Criar tabelas do banco de dados usando sqlite3
echo ">> Criando tabelas do banco de dados..."
if command -v sqlite3 > /dev/null 2>&1; then
  sqlite3 "$DB_PATH" < /app/init.sql 2>/dev/null && echo "Tabelas criadas com sucesso!" || echo "Tabelas já existem."
else
  echo "sqlite3 não encontrado, tentando prisma..."
  DATABASE_URL="file:$DB_PATH" npx prisma db push --skip-generate 2>/dev/null || echo "Prisma falhou, continuando..."
fi

# Rodar seed
echo ">> Verificando seed..."
node /app/seed-prod.mjs 2>&1 || echo "Seed falhou, continuando..."

echo "=== Iniciando servidor Next.js ==="
exec node server.js
