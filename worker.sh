#!/bin/sh
echo "=== CRM Workers — Inicializando ==="

# Verificar variáveis obrigatórias
if [ -z "$DATABASE_URL" ]; then
  echo ">> ERRO: DATABASE_URL não configurada!"
  exit 1
fi

if [ -z "$REDIS_URL" ]; then
  echo ">> ERRO: REDIS_URL não configurada!"
  exit 1
fi

echo ">> PostgreSQL: configurado"
echo ">> Redis: $REDIS_URL"
echo ">> Tenant: ${DEFAULT_TENANT_ID:-não definido}"
echo "=== Iniciando workers BullMQ ==="
exec npx tsx src/workers/crm/index.ts
