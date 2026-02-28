# 🎯 Próximos Passos - Guia Prático

## 📋 Checklist de Implementação

### ⚡ HOJE (Pré-requisitos)
- [ ] **PostgreSQL instalado**
  ```bash
  # Windows: Download https://www.postgresql.org/download/windows/
  # Ou use Docker:
  docker run -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:latest
  ```

- [ ] **Variáveis de Ambiente**
  ```bash
  # Editar .env.local
  DATABASE_URL="postgresql://usuario:senha@localhost:5432/mykaele_db"
  JWT_SECRET="sua-chave-super-secreta-aqui-123456"
  NEXTAUTH_SECRET="outra-chave-secreta-aqui-789012"
  ```

- [ ] **Criar Database**
  ```bash
  createdb mykaele_db
  # ou via pgAdmin
  ```

### ⏳ ESTA SEMANA (Setup Básico)
- [ ] **Executar Migrations**
  ```bash
  cd "c:\Users\admin\Desktop\site myka\site-mykaele"
  npx prisma migrate dev --name init
  ```

- [ ] **Testar APIs com Postman**
  - [ ] Cadastrar novo usuário (POST /api/auth/register)
  - [ ] Fazer login (POST /api/auth/login)
  - [ ] Criar agendamento (POST /api/appointments)
  - [ ] Listar disponibilidade (GET /api/appointments/availability)

- [ ] **Visualizar Dados**
  ```bash
  npx prisma studio
  # Interface gráfica em http://localhost:5555
  ```

### 🚀 PRÓXIMAS 2 SEMANAS (MVP)
- [ ] **Integração WhatsApp**
  1. Criar conta Evolution API
  2. Implementar webhook (`app/api/whatsapp/webhook/route.ts`)
  3. Testar lembretes automáticos
  4. Implementar botões de confirmação

- [ ] **Definir Dados da Clínica**
  - [ ] Cadastrar profissionais
  - [ ] Criar salas
  - [ ] Adicionar equipamentos
  - [ ] Configurar horários de trabalho

- [ ] **Personalizações**
  - [ ] Logo da clínica
  - [ ] Cores e branding
  - [ ] Textos dos serviços
  - [ ] Fotos dos profissionais

### 📅 PRÓXIMO MÊS (Polimento)
- [ ] **Stripe Integration**
- [ ] **NextAuth.js Setup**
- [ ] **Cloudinary para Fotos**
- [ ] **SendGrid para Emails**
- [ ] **Teste de Carga**

---

## 🔧 Setup Detalhado - Passo a Passo

### 1️⃣ PostgreSQL Setup

#### Opção A: Local
```bash
# Windows
# 1. Download em https://www.postgresql.org
# 2. Execute installer
# 3. Memorize a senha do postgres
# 4. Verifique porta 5432

psql -U postgres -c "CREATE DATABASE mykaele_db;"
```

#### Opção B: Docker (Recomendado)
```bash
docker run \
  -d \
  --name postgres-mykaele \
  -e POSTGRES_USER=admin \
  -e POSTGRES_PASSWORD=admin123 \
  -e POSTGRES_DB=mykaele_db \
  -p 5432:5432 \
  postgres:15-alpine

# Testar conexão
psql -h localhost -U admin -d mykaele_db
```

#### Opção C: Cloud (Prisma Postgres)
```
1. Acesse console.prisma.io
2. Click "Create Database"
3. Selecione PostgreSQL
4. Aguarde criação
5. Copie CONNECTION_STRING
6. Cole em .env.local → DATABASE_URL
```

### 2️⃣ Dependency Installation

```bash
cd "c:\Users\admin\Desktop\site myka\site-mykaele"

# Instalar dependências (já feito, mas se precisar)
npm install

# Gerar tipos do Prisma
npx prisma generate
```

### 3️⃣ Database Migration

```bash
# Criar schema no BD
npx prisma migrate dev --name init

# Ver histórico de migrations
npx prisma migrate status

# Se der erro, resetar (dev only)
npx prisma migrate reset --force
```

### 4️⃣ Visualizar Dados

```bash
# Interface gráfica do Prisma
npx prisma studio

# Abrir em http://localhost:5555
# Adicionar clínicas, profissionais, salas, equipamentos
```

### 5️⃣ Iniciar Dev Server

```bash
npm run dev

# Abrir http://localhost:3000
open http://localhost:3000
```

---

## 🧪 Testes de API

### Com cURL

```bash
# REGISTER
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "João Silva",
    "email": "joao@example.com",
    "password": "Senha123!",
    "confirmPassword": "Senha123!"
  }'

# LOGIN
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "joao@example.com",
    "password": "Senha123!"
  }'

# GET AVAILABILITY
curl "http://localhost:3000/api/appointments/availability?professionalId=prof_123&roomId=room_456&dateStart=2026-03-01&daysAhead=7"
```

### Com Postman

1. Import collection: [postman.json](./postman.json)
2. Configure variables:
   - `base_url` = `http://localhost:3000`
   - `token` = (será preenchido após login)
3. Execute em ordem:
   - Register
   - Login (copia token)
   - Create Appointment
   - List Appointments

### Com Insomnia

```bash
# Alternative curl client
# https://insomnia.rest/download
```

---

## 📱 Configuração de Dados

### Adicionar Clínica via Prisma Studio

```
1. npx prisma studio
2. Clicaq em "Clinic"
3. Click "Add record"
4. Preencha:
   - name: "Mykaele - São Paulo"
   - city: "São Paulo"
   - state: "SP"
   - address: "Av. República do Líbano, 1114"
   - phone: "(11) 99999-9999"
   - openingTime: "09:00"
   - closingTime: "21:00"
5. Save
```

### Adicionar Profissional

```
1. Primeiro, criar User (PROFESSIONAL role)
2. Depois criar ProfessionalProfile
   - specialization: "Dermatologia"
   - crm: "123456-SP"
   - experience: 15
   - qualifications: ["Especialista em Harmonização Facial"]
3. Criar WorkSchedule com horários
4. Adicionar Rooms que pode usar
```

### Adicionar Sala de Procedimento

```
1. Na Clinic criada, adicione Room:
   - name: "Consultório A"
   - type: "consultorio"
   - capacity: 1
2. Associar profissionais e equipamentos
```

---

## 🤖 Automação de Lembretes

### Quando Estiver Pronto Com WhatsApp

```bash
# 1. Criar arquivo de cron
touch src/cron/appointment-reminders.ts

# 2. Copiar código de WHATSAPP_INTEGRATION.md

# 3. Iniciar cron job (adicionar em next.config.ts ou middleware)

# 4. Testar manualmente
# Aguardar lembretes serem enviados via WhatsApp
```

---

## 📊 Monitorar Saúde da App

```bash
# Logs do servidor
npm run dev 2>&1 | tee app.log

# Verificar uso de BD
npx prisma db execute

# Gerar relatório de migrations
npx prisma migrate status

# Performance
# Abrir DevTools (F12) → Network/Performance
```

---

## 🔒 Setup de Produção

### 1️⃣ Build Otimizado

```bash
npm run build

# Verificar tamanho
du -sh .next/
```

### 2️⃣ Variáveis de Produção

```env
# .env.production
DATABASE_URL="postgresql://prod_user:prod_pass@prod_host:5432/mykaele_db"
JWT_SECRET="chave-super-segura-aleatorio-128-chars"
NEXTAUTH_SECRET="outra-chave-aleatorio-128-chars"

# WhatsApp
WHATSAPP_API_URL="https://api.evolutionapi.com"
WHATSAPP_API_KEY="sua-chave-producao"

# Stripe
STRIPE_SECRET_KEY="sk_live_..."

# URLs
NEXTAUTH_URL="https://seu-dominio.com"
NEXT_PUBLIC_APP_URL="https://seu-dominio.com"
```

### 3️⃣ Deploy Vercel

```bash
# Login Vercel
npm i -g vercel
vercel login

# Deploy
vercel

# Variáveis de ambiente (UI ou CLI)
vercel env add DATABASE_URL
vercel env add JWT_SECRET
# ... adicionar todas as variáveis
```

### 4️⃣ Monitoramento

```bash
# Adicionar Sentry para error tracking
npm install @sentry/nextjs
# Configurar em next.config.ts
```

---

## 📚 Documentos de Referência

| Arquivo | Conteúdo |
|---------|----------|
| [DOCUMENTATION.md](./DOCUMENTATION.md) | Guia técnico completo (200+ linhas) |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Diagramas e fluxos arquiteturais |
| [WHATSAPP_INTEGRATION.md](./WHATSAPP_INTEGRATION.md) | Setup WhatsApp (Evolution/Z-API) |
| [prisma/schema.prisma](./prisma/schema.prisma) | Schema do banco de dados |
| [.env.local](./.env.local) | Variáveis de ambiente (template) |

---

## 🎓 Curva de Aprendizado

### Se novo em Next.js
- [ ] Ler: [Next.js Docs - App Router](https://nextjs.org/docs/app)
- [ ] Praticar: criar uma página simples
- [ ] Entender: Server vs Client components

### Se novo em Prisma
- [ ] Ler: [Prisma Docs](https://www.prisma.io/docs/)
- [ ] Praticar: executar migrations
- [ ] Explorar: Prisma Studio

### Se novo em TypeScript
- [ ] Ler: [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [ ] Praticar: type annotations
- [ ] Entender: interfaces vs types

---

## 🐛 Troubleshooting

### Erro: "Database connection failed"
```bash
# Checar conexão PostgreSQL
psql -h localhost -U postgres -d mykaele_db

# Reiniciar PostgreSQL
# Windows: Services > PostgreSQL > Restart
# Linux: sudo systemctl restart postgresql
```

### Erro: "Migration failed"
```bash
# Ver detalhes do erro
npx prisma migrate status

# Reset (apenas dev!)
npx prisma migrate reset --force

# Ou fazer rollback
npx prisma migrate resolve --rolled-back init
```

### Erro: "Port 3000 already in use"
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -i :3000
kill -9 <PID>
```

### Erro: "ENOENT: no such file"
```bash
# Deletar cache Next.js
rm -rf .next
rm -rf node_modules/.cache

# Reiniciar servidor
npm run dev
```

---

## ✅ Checklist Final Antes de Produção

- [ ] Database configurado e migrations executadas
- [ ] Todas as variáveis de ambiente definidas
- [ ] APIs testadas com Postman
- [ ] WhatsApp integrado e testado
- [ ] Pagamentos configurados
- [ ] SSL/HTTPS ativado
- [ ] Logs e monitoring configurados
- [ ] Backup automatizado do BD
- [ ] Testes unitários escritos
- [ ] Deploy em staging funcionando
- [ ] Performance testada
- [ ] Segurança auditada

---

## 💬 Suporte

**Dúvidas?**
1. Consulte a [DOCUMENTATION.md](./DOCUMENTATION.md)
2. Verifique exemplos em `/app/api`
3. Consulte o [ARCHITECTURE.md](./ARCHITECTURE.md) para fluxos
4. Leia [WHATSAPP_INTEGRATION.md](./WHATSAPP_INTEGRATION.md) para automação

---

**Projeto pronto para decolar! 🚀**

Próximo passo: Configurar PostgreSQL e executar migrations.

```bash
cd "c:\Users\admin\Desktop\site myka\site-mykaele"
npx prisma migrate dev --name init
npm run dev
# Sucesso! 🎉
```
