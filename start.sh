#!/bin/sh
echo "=== Mykaele Home Spa - Inicializando ==="

# Verificar DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
  echo ">> ERRO: DATABASE_URL não configurada!"
  echo ">> Configure a variável de ambiente no Coolify"
  exit 1
fi

echo ">> PostgreSQL configurado"
echo "=== Iniciando servidor Next.js ==="
exec node server.js
