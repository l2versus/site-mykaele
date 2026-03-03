# 🗺️ Arquitetura da Plataforma Mykaele

## 📊 Mapa Visual da Aplicação

```
┌─────────────────────────────────────────────────────────────────────┐
│                    🌐 MYKAELE ESTÉTICA PLATFORM                     │
│                      Full-Stack Healthcare Solution                  │
└─────────────────────────────────────────────────────────────────────┘

                            ┌──────────────┐
                            │   FRONTEND   │
                            └──────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
    ┌───────────┐          ┌─────────────────┐        ┌──────────────┐
    │ LANDING   │          │    DASHBOARD    │        │    PACIENTE  │
    │   PAGE    │          │   ADMINISTRATIVO│        │    PORTAL    │
    └─────┬─────┘          └────────┬────────┘        └──────┬───────┘
          │                         │                        │
          ├─ Hero Section           ├─ Visão Geral           ├─ Dashboard
          ├─ Services               ├─ Agenda Visual         ├─ Agendamentos
          ├─ Profissionais          ├─ Financeiro            ├─ Antes/Depois
          ├─ Tecnologias            ├─ Pacientes             └─ Produtos
          └─ Footer                 ├─ Profissionais
                                    ├─ Recursos
                                    └─ Relatórios

                            ┌──────────────┐
                            │   BACKEND    │
                            └──────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
    ┌────────────┐         ┌─────────────┐          ┌──────────────┐
    │  AUTH API  │         │  APPOINT.   │          │  PAYMENTS    │
    │            │         │    API      │          │    API       │
    └─────┬──────┘         └──────┬──────┘          └──────┬───────┘
          │                       │                        │
          ├─ POST Register        ├─ POST Create          ├─ POST Create
          ├─ POST Login           ├─ GET List             ├─ GET History
          ├─ JWT Encode           ├─ GET Availability     └─ Split Calc
          └─ Hash Password        ├─ Validate 3D
                                  └─ Auto Reminders

                            ┌──────────────┐
                            │ DATABASE     │
                            │ PostgreSQL   │
                            └──────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
    ┌────────────┐         ┌─────────────┐          ┌──────────────┐
    │  USUARIOS  │         │  AGENDAMENTOS           │  FINANCEIRO  │
    │            │         │              │          │              │
    ├─ User     │         ├─ Appointment │         ├─ Payment     │
    ├─ Patient  │         ├─ Reminder    │         ├─ Commission  │
    └─ Prof     │         └─ Room+ Equip │         └─ Receipt     │
                                  │
                        ┌─────────┴──────────┐
                        │                    │
                    ┌──────────┐        ┌─────────┐
                    │ Clinic   │        │ Photos  │
                    │ Schedule │        │ Logs    │
                    └──────────┘        └─────────┘

                    ┌──────────────────────────┐
                    │   AUTOMAÇÕES EXTERNAS   │
                    └──────────────────────────┘
                                │
        ┌───────────────────────┼────────────────────────┐
        │                       │                        │
    ┌──────────────┐      ┌──────────────┐      ┌───────────────┐
    │   WHATSAPP   │      │  CRONJOBS    │      │  INTEGRAÇÕES  │
    │  (Evolution) │      │              │      │               │
    └──────────────┘      ├─ Lembretes  │      ├─ Stripe       │
                          ├─ Relatórios │      ├─ Cloudinary   │
                          └─ Limpeza    │      └─ SendGrid     │
                                        │
                                    [PRONTO]

```

---

## 🔄 Fluxo de Dados - Agendamento

```
PACIENTE                FRONTEND               BACKEND                DATABASE
   │                      │                       │                       │
   └──► Click "Agendar"──►│                       │                       │
        └──► Busca Slots──►│                       │                       │
             └──► Call API────────► GET /api/appointments/availability     │
                           │        └─► checkAvailability() ────────────────┤
                           │◄────────────────── Slots de 60min             │
             ◄────────────┤
   ◄────────────────────────                      │                       │
   │                                              │                       │
   │  Seleciona Horário                          │                       │
   └──► Preenche Formulário──►│                   │                       │
        Nome, Serviço, etc    └──► POST /api/appointments ────────────────►│
                              │    ├─ Validar entrada                      │
                              │    ├─ Criar Appointment                    │
                              │    ├─ Criar AppointmentReminder            │
                              │    └─ Validar Disponibilidade 3D │
                              │◄────── {202 Created}              │
        ◄────────────┤        │                                       │
   ◄────────────────── Agendamento Confirmado                        │
   │                          │                       │              │
   │  [BACKGROUND]            │                       │              │
   │  Cronjob a cada 1h       │                       │              │
   │                          │                       │              │
   │                          │    Query AppointmentReminder       │
   │                          │    ├─ Buscar que vence em 48h      │
   │                          │    └─ Buscar que não foramreminders │
   │                          │◄───────────────────────────────────→│
   │                          │                                      │
   │◄─ SMS/WhatsApp ─────────┤◄────── Send Message                 │
   │ "Lembrete em 48h"        │    ├─ generateButtons()             │
   │ [Confirmar] [Reagendar]  │    └─ Update reminder.sent=true     │
   │                          │                                      │
   └──► Click [Confirmar]────►│                                      │
        └──► Webhook received──────► POST /api/whatsapp/webhook     │
                              │      ├─ Parse buttonId              │
                              │      ├─ Update Appointment status   │
                              │      └─ Update reminder.sentAt      │
                              │◄──────────────────────────────────→│
        ◄────────────┤
   ◄────────────── "✅ Confirmado!"

```

---

## 🏗️ Stack de Tecnologias

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND LAYER                       │
├─────────────────────────────────────────────────────────┤
│ • Next.js 14 (App Router)                               │
│ • React 19 (com Server Components)                      │
│ • TypeScript (strict mode)                              │
│ • Tailwind CSS 4 (utilitário)                           │
│ • Componentes customizados                              │
│ • date-fns (manipulação de datas)                       │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                    BACKEND LAYER                        │
├─────────────────────────────────────────────────────────┤
│ • Node.js + Next.js API Routes                          │
│ • Prisma ORM (type-safe queries)                        │
│ • PostgreSQL (banco relacional)                         │
│ • bcryptjs (hash de senhas)                             │
│ • jsonwebtoken (autenticação)                           │
│ • Zod (validação de schemas)                            │
│ • node-cron (agendamento de tarefas)                    │
│ • axios (requisições HTTP)                              │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                  INTEGRATIONS READY                     │
├─────────────────────────────────────────────────────────┤
│ • Evolution API (WhatsApp - documentado)                │
│ • Z-API (WhatsApp alternativo)                          │
│ • Stripe (Pagamentos - ready for connect)               │
│ • Cloudinary (Upload de imagens)                        │
│ • SendGrid (Email transacional)                         │
│ • Google Analytics (Analytics)                          │
└─────────────────────────────────────────────────────────┘

```

---

## 📦 Modelos de Dados - Relacionamentos

```
                        ┌─────────────┐
                        │    USER     │
                        └──────┬──────┘
                               │
                    ┌──────────┼──────────┐
                    │          │          │
            ┌───────────────┐ │         ┌──────────────┐
            │ PATIENT       │ │         │ PROFESSIONAL │
            │ PROFILE       │ │         │ PROFILE      │
            └───────────────┘ │         └──────┬───────┘
                              │                │
                        ┌─────┴──────┐     ┌────────────┐
                        │   CLINIC   │     │ WORK       │
                        │            │     │ SCHEDULE   │
                        └─────┬──────┘     └────────────┘
                              │
                    ┌─────────┴──────────┐
                    │                    │
                ┌──────────┐        ┌───────────┐
                │  ROOM    │        │ EQUIPMENT │
                │          │        │           │
                └─────┬────┘        └─────┬─────┘
                      │                   │
                      └───────┬───────────┘
                              │
                        ┌─────────────────┐
                        │ APPOINTMENT     │
                        │ (3D VALIDATION) │
                        └────────┬────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
            ┌──────────────┐        ┌──────────────────┐
            │APPOINTMENT   │        │ BEFORE AFTER     │
            │REMINDER      │        │ PHOTO            │
            └──────────────┘        └──────────────────┘

                        ┌──────────────┐
                        │  PAYMENT     │
                        │              │
                        │ originalAmt  │
                        │ - cardFee    │
                        │ - tax        │
                        │ - productCst │
                        │ ─────────────│
                        │ profComm 40% │
                        │ clinicRev 60%│
                        └──────────────┘
```

---

## 🔐 Fluxo de Autenticação

```
┌──────────────────────────────────────────────────────────────┐
│                  AUTENTICAÇÃO - JWT + BCRYPT                 │
└──────────────────────────────────────────────────────────────┘

REGISTER FLOW:
┌──────────┐      ┌─────────────────────────────────────────┐
│ Client   │─────►│ POST /api/auth/register                 │
│ browser  │      │ { name, email, password, ... }          │
└──────────┘      └────────────┬──────────────────────────────┘
                               │
                    ┌──────────┴────────────┐
                    │                       │
            ┌──────────────────┐    ┌──────────────────┐
            │ Validate Zod    │    │ Hash Password    │
            │ Schema          │    │ bcryptjs 10      │
            └─────────┬────────┘    └────────┬─────────┘
                      │                       │
            ┌─────────┴──────────────┬──────────┘
            │                        │
        ┌──────────────────────────────────────┐
        │ CREATE User + PatientProfile         │
        │                                      │
        │ await prisma.user.create({           │
        │   email, name, password: hashedPw,   │
        │   role: 'PATIENT'                    │
        │ })                                   │
        └──────────────┬───────────────────────┘
                       │
            ┌──────────┴───────────────┐
            │                          │
        ┌──────────────────┐    ┌─────────────────┐
        │ Generate JWT     │    │ Return {        │
        │ jwt.sign({       │    │   user,         │
        │   userId,        │    │   token         │
        │   email,         │    │ }               │
        │   role           │    └─────────────────┘
        │ }, secret, 7d)   │
        └──────────────────┘

LOGIN FLOW:
┌──────────┐      ┌─────────────────────────────────────────┐
│ Client   │─────►│ POST /api/auth/login                    │
│ browser  │      │ { email, password }                     │
└──────────┘      └────────────┬──────────────────────────────┘
                               │
                    ┌──────────┴────────────┐
                    │                       │
            ┌──────────────────┐    ┌──────────────────────┐
            │ Buscar User      │    │ bcryptjs.compare()   │
            │ by Email         │    │ input vs hashed      │
            └────────┬─────────┘    └────────┬─────────────┘
                     │                       │
            ┌────────┴───────────────────────┴────┐
            │ PASSWORD CORRETO?                   │
            │      SIM          │      NÃO        │
            └──────────┬────────┴────────┬────────┘
                       │                 │
            ┌──────────────────┐    ┌────────────┐
            │ Generate JWT     │    │ 401 Error  │
            │ Retornar token   │    │ Unauth     │
            └──────────────────┘    └────────────┘
```

---

## 🎯 Fluxo de Agendamento 3D

```
User seleciona:
  ┌─────────────────────┐
  │ Profissional: Dra.A │
  │ Sala: Laser Zone    │
  │ Equipmnt: CO2 v2.0  │
  │ Data: 15/Mar 14:00  │
  └──────────┬──────────┘
             │
             ├─►  checkAvailability(
             │       prof_id='xxx',
             │       room_id='yyy',
             │       equip_id='zzz',
             │       date=15/Mar 14:00,
             │       duration=60min
             │    )
             │
    ┌────────┴─────────────────────┐
    │ Buscar conflicts no BD        │
    │                               │
    ├─ Appointments de PROF onde:  │
    │  - status IN ['CONFIRMED',   │
    │              'COMPLETED']    │
    │  - scheduledAt BETWEEN       │
    │    (14:00 - 60min) e        │
    │    (14:00 + 60min)          │
    │                              │
    ├─ Appointments de ROOM onde:  │
    │  - mesmo intervalo          │
    │  - status = 'CONFIRMED'      │
    │                              │
    ├─ Appointments de EQUIP:      │
    │  - mesmo intervalo          │
    │  - status = 'CONFIRMED'      │
    │                              │
    └────────┬────────────────────┘
             │
    ┌────────┴──────────┐
    │ Conflitos?        │
    │                   │
    ├─ NÃO              │
    │  ├─ Criar         │
    │  │  Appointment   │
    │  └─ Criar         │
    │     Reminder      │
    │                   │
    └─ SIM              │
       └─ 409 Conflict  │

RESULTADO:
✅ Slot está livre → Agendamento criado + Reminder criado
❌ Slot ocupado → HTTP 409 "Horário não disponível"
```

---

## 📈 Camadas do Projeto

```
┌────────────────────────────────────────────────────────────┐
│                   PRESENTATION LAYER                       │
│                   (Next.js Pages + UI)                     │
├────────────────────────────────────────────────────────────┤
│ • Homepage (/)                                             │
│ • Dashboard (/dashboard/*)                                 │
│ • Patient Portal (/patient/*)                              │
│ • Componentes reutilizáveis (Header, Button, etc)          │
└────────────────┬───────────────────────────────────────────┘
                 │
┌────────────────┴───────────────────────────────────────────┐
│                  BUSINESS LOGIC LAYER                      │
│               (Validações, Cálculos, Regras)               │
├────────────────────────────────────────────────────────────┤
│ • src/utils/validation.ts (Zod schemas)                    │
│ • src/utils/availability.ts (lógica 3D)                    │
│ • src/utils/payment-calculator.ts (split)                  │
│ • src/lib/auth.ts (senha, JWT)                             │
└────────────────┬───────────────────────────────────────────┘
                 │
┌────────────────┴───────────────────────────────────────────┐
│                  API LAYER                                 │
│              (Next.js API Routes)                          │
├────────────────────────────────────────────────────────────┤
│ • [POST] /api/auth/register                                │
│ • [POST] /api/auth/login                                   │
│ • [POST] /api/appointments                                 │
│ • [GET]  /api/appointments/availability                    │
│ • [POST] /api/payments                                     │
└────────────────┬───────────────────────────────────────────┘
                 │
┌────────────────┴───────────────────────────────────────────┐
│                  DATA LAYER                                │
│           (Prisma ORM + PostgreSQL)                        │
├────────────────────────────────────────────────────────────┤
│ • User (13 models)                                         │
│ • Appointments (with indices)                              │
│ • Payments (with split logic)                              │
│ • Clinic Resources (Rooms, Equipment)                      │
└────────────────────────────────────────────────────────────┘
```

---

## 🚀 Pipeline de Deployment

```
┌─────────────────────────────────────────────────────────┐
│  LOCAL DEVELOPMENT                                      │
│  npm run dev → http://localhost:3000                    │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│  BUILD                                                  │
│  npm run build                                          │
│  Next.js optimización + TypeScript check                │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│  STAGING (Coolify Preview)                              │
│  git push → Coolify deploys automatically               │
│  Teste end-to-end antes de produção                     │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│  PRODUCTION (Coolify + Docker + PostgreSQL)              │
│  Docker container via Dockerfile                        │
│  Database migrations via Prisma                         │
│  Monitoring + Sentry for errors                         │
└─────────────────────────────────────────────────────────┘
```

---

**Arquitetura 100% escalável e mantível! 🎯**
