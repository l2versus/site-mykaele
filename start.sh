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

# Configurar admins (atualizar senhas e criar dev admin)
echo ">> Configurando admins..."
node /app/seed-admins.mjs 2>&1 || echo "Seed admins falhou, continuando..."

# Garantir DATABASE_URL para o Next.js
export DATABASE_URL="file:/app/data/mykaele.db"

# Migrar colunas se não existirem (bancos antigos)
sqlite3 "$DB_PATH" "ALTER TABLE User ADD COLUMN forcePasswordChange INTEGER NOT NULL DEFAULT 0;" 2>/dev/null || true
sqlite3 "$DB_PATH" "ALTER TABLE User ADD COLUMN emailVerified INTEGER NOT NULL DEFAULT 0;" 2>/dev/null || true
sqlite3 "$DB_PATH" "ALTER TABLE User ADD COLUMN emailVerifiedAt DATETIME;" 2>/dev/null || true

# Criar índice único no phone (se não existir)
sqlite3 "$DB_PATH" "CREATE UNIQUE INDEX IF NOT EXISTS User_phone_key ON User(phone);" 2>/dev/null || true

# Criar tabela EmailVerificationToken se não existir
sqlite3 "$DB_PATH" "CREATE TABLE IF NOT EXISTS EmailVerificationToken (
    id TEXT PRIMARY KEY NOT NULL,
    token TEXT NOT NULL UNIQUE,
    userId TEXT NOT NULL,
    email TEXT NOT NULL,
    expiresAt DATETIME NOT NULL,
    usedAt DATETIME,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);" 2>/dev/null || true
sqlite3 "$DB_PATH" "CREATE INDEX IF NOT EXISTS EmailVerificationToken_token_idx ON EmailVerificationToken(token);" 2>/dev/null || true
sqlite3 "$DB_PATH" "CREATE INDEX IF NOT EXISTS EmailVerificationToken_userId_idx ON EmailVerificationToken(userId);" 2>/dev/null || true

echo "=== Iniciando servidor Next.js ==="
exec node server.js
