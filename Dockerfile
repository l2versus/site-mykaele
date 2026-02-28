# ============================================
# Mykaele Home Spa — Dockerfile para Coolify
# ============================================

# --- Stage 1: Instalar dependências ---
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci && npm cache clean --force

# --- Stage 2: Build da aplicação ---
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Gerar Prisma Client
RUN npx prisma generate

# Build Next.js (NEXT_PUBLIC vars precisam estar no build)
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_APP_URL=https://mykaprocopio.com.br
ENV NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=APP_USR-2947efe4-78be-4858-adc7-b62a8393a78f
RUN npm run build

# --- Stage 3: Imagem de produção ---
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Instalar sqlite3 para inicialização do banco
RUN apk add --no-cache sqlite

# Criar usuário não-root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copiar arquivos necessários
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/bcryptjs ./node_modules/bcryptjs
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Script de inicialização e banco de dados
COPY init.sql ./init.sql
COPY seed-prod.mjs ./seed-prod.mjs
COPY start.sh ./start.sh
RUN chmod +x ./start.sh

# Criar diretório persistente para banco de dados SQLite
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["sh", "./start.sh"]
