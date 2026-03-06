#!/bin/sh
echo "=== Mykaele Home Spa - Inicializando ==="

# Verificar qual banco usar
if [ -n "$DATABASE_URL" ] && echo "$DATABASE_URL" | grep -q "postgres"; then
  echo ">> Modo PostgreSQL detectado"
  echo ">> Banco já configurado no Coolify"
  echo ">> Pulando seeds (dados já existem no PostgreSQL)"
else
  echo ">> Modo SQLite local"
  DB_PATH="/app/data/mykaele.db"
  export DATABASE_URL="file:$DB_PATH"
  
  # Criar tabelas do banco de dados usando sqlite3
  echo ">> Criando tabelas do banco de dados..."
  if command -v sqlite3 > /dev/null 2>&1; then
    sqlite3 "$DB_PATH" < /app/init.sql 2>/dev/null && echo "Tabelas criadas com sucesso!" || echo "Tabelas já existem."
  fi

  # Rodar seed
  echo ">> Verificando seed..."
  node /app/seed-prod.mjs 2>&1 || echo "Seed falhou, continuando..."

  # Configurar admins
  echo ">> Configurando admins..."
  node /app/seed-admins.mjs 2>&1 || echo "Seed admins falhou, continuando..."

  # Migrar colunas SQLite se não existirem
  sqlite3 "$DB_PATH" "ALTER TABLE User ADD COLUMN forcePasswordChange INTEGER NOT NULL DEFAULT 0;" 2>/dev/null || true
  sqlite3 "$DB_PATH" "ALTER TABLE User ADD COLUMN emailVerified INTEGER NOT NULL DEFAULT 0;" 2>/dev/null || true
  sqlite3 "$DB_PATH" "ALTER TABLE User ADD COLUMN emailVerifiedAt DATETIME;" 2>/dev/null || true
  sqlite3 "$DB_PATH" "CREATE UNIQUE INDEX IF NOT EXISTS User_phone_key ON User(phone);" 2>/dev/null || true
fi

echo "=== Iniciando servidor Next.js ==="
exec node server.js
