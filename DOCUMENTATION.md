# 🏥 Plataforma Mykaele - Documentação

## Status do Projeto

### ✅ Implementado
- [x] **Stack**: Next.js 14, TypeScript, Tailwind CSS, Prisma, PostgreSQL
- [x] **Database Schema**: Modelo 3D de agendamento (Profissional + Sala + Equipamento)
- [x] **Componentes UI**: Header, Hero, Services, Professionals, Technologies, Footer
- [x] **Landing Page**: Design "Quiet Beauty" minimalista e elegante
- [x] **APIs de Autenticação**: Register, Login com JWT
- [x] **APIs de Agendamento**: CREATE, GET, Verificação de disponibilidade 3D
- [x] **APIs de Pagamento**: Sistema de split com cálculo automático
- [x] **Validações**: Zod schemas para todas as rotas

### 🚧 Em Desenvolvimento
- [ ] Dashboard Administrativo (recepcção, agenda, financeiro)
- [ ] Área do Paciente (histórico, antes/depois, pós-venda)
- [ ] Integração WhatsApp (Evolution/Z-API)
- [ ] Cronjobs para lembretes automáticos
- [ ] Sistema completo de split de pagamentos
- [ ] Autenticação com NextAuth.js

---

## 🗂️ Estrutura do Projeto

```
site-mykaele/
├── prisma/
│   └── schema.prisma          # Schema com modelo 3D de agendamento
├── src/
│   ├── components/            # Componentes React reutilizáveis
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Header.tsx
│   │   ├── HeroSection.tsx
│   │   ├── ServicesSection.tsx
│   │   ├── ProfessionalsSection.tsx
│   │   ├── TechnologiesSection.tsx
│   │   └── Footer.tsx
│   ├── lib/
│   │   ├── prisma.ts         # Cliente Prisma singleton
│   │   └── auth.ts           # Hash, JWT, autenticação
│   ├── utils/
│   │   ├── validation.ts     # Schemas Zod
│   │   ├── availability.ts   # Lógica 3D de disponibilidade
│   │   └── payment-calculator.ts  # Split de pagamentos
│   └── hooks/               # Hooks React customizados
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── register/route.ts
│   │   │   └── login/route.ts
│   │   ├── appointments/
│   │   │   ├── route.ts      # POST (criar), GET (listar)
│   │   │   └── availability/route.ts  # GET slots disponíveis
│   │   └── payments/
│   │       └── route.ts      # POST, GET
│   ├── dashboard/           # Admin dashboard (próximo)
│   ├── patient/            # Área do paciente (próximo)
│   ├── layout.tsx
│   ├── page.tsx            # Homepage
│   └── globals.css
├── .env.local              # Variáveis de ambiente
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🚀 Como Configurar

### 1. Pré-requisitos
- Node.js 18+
- PostgreSQL instalado ou Docker

### 2. Instalação

```bash
cd "c:\Users\admin\Desktop\site myka\site-mykaele"
npm install
```

### 3. Configurar Banco de Dados

#### Opção A: PostgreSQL Local
```bash
# Criar database
createdb mykaele_db

# Atualizar .env.local
DATABASE_URL="postgresql://usuario:senha@localhost:5432/mykaele_db"
```

#### Opção B: PostgreSQL com Prisma Cloud (Recomendado para produção)
```bash
# Acessar console.prisma.io
# Criar novo database PostgreSQL
# Copiar DATABASE_URL para .env.local
```

### 4. Executar Migrations

```bash
# Criar tabelas no banco de dados
npx prisma migrate dev --name init

# Visualizar dados (opcional)
npx prisma studio
```

### 5. Iniciar Desenvolvimento

```bash
npm run dev
# Acesso em http://localhost:3000
```

---

## 📡 APIs Principais

### Auth

**POST** `/api/auth/register`
```json
{
  "name": "João Silva",
  "email": "joao@example.com",
  "password": "Senha123!",
  "confirmPassword": "Senha123!"
}
```

**POST** `/api/auth/login`
```json
{
  "email": "joao@example.com",
  "password": "Senha123!"
}
```

---

### Agendamentos

**POST** `/api/appointments`
```json
{
  "patientId": "user_id_123",
  "professionalId": "prof_id_456",
  "clinicId": "clinic_id_789",
  "roomId": "room_id_012",
  "equipmentId": "equipment_id_345",
  "service": "Harmonização Facial",
  "scheduledAt": "2026-03-15T14:00:00Z",
  "duration": 60,
  "notes": "Paciente com sensibilidade baixa"
}
```

**GET** `/api/appointments/availability`
```
?professionalId=prof_123
&roomId=room_456
&dateStart=2026-03-01
&daysAhead=7
```

**GET** `/api/appointments`
```
?patientId=patient_123
```

---

### Pagamentos

**POST** `/api/payments`
```json
{
  "patientId": "patient_123",
  "amount": 1000.00,
  "paymentMethod": "cartao_credito",
  "description": "Harmonização Facial"
}
```

Resposta com split:
```json
{
  "payment": {...},
  "breakdown": {
    "originalAmount": 1000.00,
    "cardFee": 29.90,
    "tax": 30.00,
    "productCost": 50.00,
    "professionalCommission": 376.01,
    "clinicRevenue": 514.09
  }
}
```

---

## 🗃️ Schema do Banco de Dados

### Tabelas Principais

1. **User** - Usuários (Pacientes, Profissionais, Admin)
2. **PatientProfile** - Dados do paciente
3. **ProfessionalProfile** - Dados do profissional
4. **Clinic** - Clínicas / unidades
5. **Room** - Salas de procedimento
6. **Equipment** - Equipamentos (Lasers, etc)
7. **WorkSchedule** - Horários de trabalho
8. **Appointment** - Agendamentos (com índices para 3D)
9. **Payment** - Pagamentos com split
10. **BeforeAfterPhoto** - Fotos antes/depois

---

## 🎯 Próximas Etapas

### 1. Dashboard Administrativo
- Agenda visual com drag-drop
- Estatísticas financeiras
- Gerenciamento de profissionais/salas
- Análise de disponibilidade

### 2. Área do Paciente
- Login/Dashboard pessoal
- Histórico de agendamentos
- Slider antes/depois
- Produtos pós-venda (upsell)

### 3. WhatsApp Automático
- Integração com Evolution/Z-API
- Lembretes 48h e 24h
- Botões de confirmação
- Webhook para atualizar status

### 4. Cronjobs
- node-cron para lembretes
- Processar pagamentos pendentes
- Gerar relatórios
- Limpeza de dados antigos

### 5. Integrações
- Stripe/PagSeguro (pagamentos)
- SendGrid/Gmail (emails)
- Cloudinary (fotos)
- Sentry (monitoramento)

---

## 🔐 Variáveis de Ambiente

Ver `.env.local` para lista completa. Principais:

```
DATABASE_URL=postgresql://...
JWT_SECRET=seu-secret-aqui
NEXTAUTH_SECRET=seu-secret-aqui
WHATSAPP_API_URL=https://api.evolutionapi.com
WHATSAPP_API_KEY=...
```

---

## 📚 Recursos

- [Next.js Docs](https://nextjs.org/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [Tailwind CSS](https://tailwindcss.com)
- [TypeScript](https://www.typescriptlang.org)

---

## 📞 Suporte

Para dúvidas ou bugs:
1. Verificar documentação
2. Consultar exemplos em `/app/api`
3. Validar schema.prisma
4. Checar logs do servidor

---

**Desenvolvido com ❤️ usando VSCode + GitHub Copilot + Claude**
