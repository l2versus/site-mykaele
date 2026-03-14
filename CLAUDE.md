# CLAUDE.md — Clínica Mykaele Procópio · CRM "Kommo Killer"
> **LEIA ESTE ARQUIVO INTEIRO ANTES DE ESCREVER QUALQUER LINHA DE CÓDIGO.**
> Você é o Tech Lead Sênior, Arquiteto de Software e Head of Design deste projeto.
> **Versão: 8.0 (Português Completo + Regras de Implementação)** — Março 2026
>
> Auditoria completa realizada: 35+ arquivos lidos, 27 models preservados,
> risco de regressão BAIXO (96% do código é aditivo).

---

## ÍNDICE
1. [Identidade do Projeto](#1-identidade-do-projeto)
2. [Stack Tecnológica Real](#2-stack-tecnológica-real-verificada-no-projeto)
3. [Isolamento Arquitetural](#3-regra-absoluta-isolamento-arquitetural)
4. [Estrutura do Projeto](#4-estrutura-do-projeto)
5. [Schema Existente — NÃO ALTERAR](#5-schema-prisma-existente-27-models--não-alterar)
6. [Schema CRM — ADICIONAR AO FINAL](#6-schema-crm-completo)
7. [Infraestrutura Base](#7-infraestrutura-base)
8. [SSE — Tempo Real](#8-sse--apicrmstream)
9. [Webhook Handler](#9-webhook-handler)
10. [Workers CRM](#10-workers-crm)
11. [Pipeline RAG](#11-pipeline-rag--módulo-5)
12. [LGPD](#12-lgpd-audit-log--anonimização)
13. [Cofre de Mídia](#13-cofre-de-mídia)
14. [UX Premium](#14-ux-premium)
15. [Roteiro de 5 Módulos](#15-roteiro-de-5-módulos)
16. [Interface DLQ](#16-interface-dlq-admin)
17. [Padrões de Código](#17-padrões-de-código-obrigatórios)
18. [Variáveis de Ambiente](#18-variáveis-de-ambiente)
19. [Contexto de Negócio](#19-contexto-de-negócio)
20. [Comandos Úteis](#20-comandos-úteis)
21. [Protocolo de Auditoria Pré-Código](#21-protocolo-de-auditoria-pré-código)
22. [Padrão de Design Silicon Valley](#22-padrão-de-design-silicon-valley-tier-1)
23. [Fases de Implementação](#23-fases-de-implementação)
24. [Protocolo de Entrega](#24-protocolo-de-entrega)

---

## 1. IDENTIDADE DO PROJETO

| Campo | Valor |
|---|---|
| **Produto** | SaaS / CRM premium para clínicas de estética de luxo |
| **Dev/CEO** | EB Develop |
| **Cliente V1** | Clínica Mykaele Procópio |
| **Benchmark** | Kommo CRM — superar em 10x |
| **Hospedagem** | VPS via Coolify (Docker Compose) |
| **Idioma** | Português do Brasil (pt-BR) |

**Missão:** Ninguém agenda R$4.000 em procedimento conversando com bot engessado. O CRM empodera a recepcionista com contexto instantâneo, IA RAG que conhece os protocolos da clínica, e UX de aplicativo nativo Apple.

---

## 2. STACK TECNOLÓGICA REAL (VERIFICADA NO PROJETO)

| Camada | Tecnologia | Caminho/Nota |
|---|---|---|
| Framework | Next.js 16.1.6 (App Router) | Componentes de Servidor por padrão |
| Linguagem | TypeScript 5 estrito | Zero `any`, zero `as unknown` |
| ORM | Prisma 7.4 + PostgreSQL | `@prisma/adapter-pg` — `src/lib/prisma.ts` |
| Autenticação | JWT (`jsonwebtoken`) | `src/lib/auth.ts` — `verifyToken()` |
| Pagamentos | Mercado Pago SDK | `src/lib/mercadopago.ts` — NÃO TOCAR |
| E-mail | Resend | `src/lib/email.ts` |
| WhatsApp Atual | CallMeBot | `src/lib/whatsapp.ts` |
| Limite de Taxa | Em memória | `src/lib/rate-limit.ts` |
| Estilo | Tailwind CSS 4 | Modo escuro obrigatório |
| Animações | Framer Motion + GSAP | Física real no arrasta e solta |
| Tempo Real | SSE (Server-Sent Events) | Reutilizar pipeline do GPS (`/api/gps/stream`) |
| Mensageria WA | Evolution API v2 | Container Docker isolado (NOVO) |
| Filas | BullMQ + Redis | Worker separado + DLQ gratuito (NOVO) |
| Arrasta e Solta | @hello-pangea/dnd | Índice Fracionário (NOVO) |
| Construtor Visual | React Flow (@xyflow/react) | DAG → JSON (NOVO) |
| Estado Global | Zustand + `useOptimistic` | (NOVO) |
| Criptografia | `crypto` (Node nativo) | AES-256-GCM (NOVO) |
| IA/Embeddings | OpenAI `text-embedding-3-small` | 1536 dim + pgvector (NOVO) |
| Análise de PDF | `pdf-parse` | (NOVO) |

### Alias de Importação (tsconfig.json)
```json
{
  "paths": {
    "@/*": ["src/*"],
    "@/components/*": ["src/components/*"]
  }
}
```
**Ou seja:** `import { prisma } from '@/lib/prisma'` aponta para `src/lib/prisma.ts`

---

## 3. REGRA ABSOLUTA: ISOLAMENTO ARQUITETURAL

### 3.1 — Fluxos Críticos (INTOCÁVEIS)
```
NÃO MEXER: Agendamentos   → Appointment, Schedule, BlockedDate
NÃO MEXER: Pagamentos     → Payment, Expense, Mercado Pago
NÃO MEXER: Autenticação   → middleware.ts, src/lib/auth.ts, verifyToken
NÃO MEXER: GPS Tempo Real → SSE + Leaflet
NÃO MEXER: Vitrine 3D     → Session Tickets
NÃO MEXER: Fidelidade     → LoyaltyPoints, LoyaltyTransaction
```

### 3.2 — Regras de Banco de Dados
- **NUNCA** alterar `Appointment`, `User`, `Payment`, `Package`, `Service`, `Schedule`
- Única ponte: **FKs opcionais** (`patientId String?`) — sem `@relation()`, apenas texto
- **Exclusão Lógica** em todo Lead (`deletedAt DateTime?`)
- **Exclusão Definitiva** apenas via `anonymizeLead()` da `src/lib/lgpd.ts`

### 3.3 — Middleware: Rota Pública do Webhook

O middleware atual (`middleware.ts`) usa `PUBLIC_PATHS` (correspondência exata) e `PUBLIC_PREFIXES` (correspondência por prefixo):

```typescript
// middleware.ts — ADICIONAR ao array PUBLIC_PATHS (NÃO remover nenhum existente):
const PUBLIC_PATHS = [
  '/api/webhooks/evolution',  // ← OBRIGATÓRIO para CRM
  // ... rotas existentes permanecem intactas
]

// ADICIONAR ao PUBLIC_PREFIXES:
const PUBLIC_PREFIXES = [
  '/check-in/',
  '/api/crm/stream',  // ← SSE não envia cabeçalho Bearer
]
```

### 3.4 — Cadeia de Raciocínio Obrigatória
Antes de cada arquivo CRM, pergunte-se:
1. "Isso quebra Agendamento, Pagamento ou GPS?"
2. "Escala com `tenantId` para 50 clínicas?"
3. "Por que é 10x melhor que o Kommo?"

---

## 4. ESTRUTURA DO PROJETO

```
site-mykaele/
├── app/                           # Next.js App Router
│   ├── admin/                     # Painel administrativo (40+ rotas)
│   │   ├── layout.tsx             # Layout com sidebar (19 itens + CRM)
│   │   ├── AdminContext.tsx       # Contexto de auth admin
│   │   ├── agenda/                # Agendamentos (INTOCÁVEL)
│   │   ├── clientes/              # Clientes (INTOCÁVEL)
│   │   ├── financeiro/            # Financeiro (INTOCÁVEL)
│   │   ├── rastreamento/          # GPS com SSE (REFERÊNCIA)
│   │   └── crm/                   # <<< CRM NOVO AQUI
│   │       ├── layout.tsx         # Layout isolado do CRM
│   │       ├── page.tsx           # Redireciona para pipeline
│   │       ├── pipeline/          # Kanban
│   │       ├── inbox/             # Caixa de entrada WhatsApp
│   │       ├── contacts/          # Lista de contatos
│   │       ├── intelligence/      # IA + Janela de Ouro
│   │       ├── automations/       # Construtor visual
│   │       ├── integrations/      # Conexões (WhatsApp, etc)
│   │       └── system/dlq/        # Administração de falhas
│   │
│   ├── api/
│   │   ├── crm/                   # <<< APIs CRM NOVAS
│   │   │   ├── stream/route.ts    # SSE CRM
│   │   │   ├── leads/             # CRUD de leads
│   │   │   ├── conversations/     # Caixa de entrada
│   │   │   └── knowledge/upload/  # Upload RAG
│   │   └── webhooks/
│   │       └── evolution/route.ts # <<< Webhook Evolution API
│   │
│   ├── globals.css                # Adicionar variáveis CRM (NÃO substituir)
│   └── layout.tsx                 # Layout raiz (NÃO TOCAR)
│
├── src/
│   ├── lib/                       # Utilitários
│   │   ├── auth.ts                # (EXISTENTE — NÃO TOCAR)
│   │   ├── prisma.ts              # (EXISTENTE — apenas ADICIONAR helpers)
│   │   ├── mercadopago.ts         # (EXISTENTE — NÃO TOCAR)
│   │   ├── whatsapp.ts            # (EXISTENTE — NÃO TOCAR)
│   │   ├── email.ts               # (EXISTENTE — NÃO TOCAR)
│   │   ├── rate-limit.ts          # (EXISTENTE — NÃO TOCAR)
│   │   ├── media-catalog.ts       # (EXISTENTE — NÃO TOCAR)
│   │   ├── crypto.ts              # <<< NOVO: AES-256-GCM
│   │   ├── evolution-api.ts       # <<< NOVO: Cliente Evolution API
│   │   ├── audit.ts               # <<< NOVO: Log de auditoria LGPD
│   │   ├── rag.ts                 # <<< NOVO: Embeddings + pgvector
│   │   ├── lgpd.ts                # <<< NOVO: Anonimização
│   │   ├── fractional-index.ts    # <<< NOVO: Posição Kanban
│   │   ├── crm-animations.ts      # <<< NOVO: Animações CRM
│   │   ├── crm-feedback.ts        # <<< NOVO: Sons + vibração
│   │   └── queues/
│   │       ├── index.ts           # <<< NOVO: Configuração BullMQ
│   │       └── scheduler.ts       # <<< NOVO: Tarefas agendadas
│   │
│   ├── components/
│   │   ├── crm/                   # <<< COMPONENTES CRM NOVOS
│   │   │   ├── LeadCard.tsx       # Card do lead no Kanban
│   │   │   ├── StageColumn.tsx    # Coluna do Kanban
│   │   │   ├── LeadDrawer.tsx     # Painel lateral do lead
│   │   │   ├── NewLeadModal.tsx   # Modal de criação
│   │   │   └── CrmNav.tsx         # Sub-navegação do CRM
│   │   ├── dashboard/             # (EXISTENTE — NÃO TOCAR)
│   │   └── patient/               # (EXISTENTE — NÃO TOCAR)
│   │
│   ├── hooks/
│   │   ├── useHaptic.ts           # (EXISTENTE — REUTILIZAR)
│   │   ├── useConfetti.ts         # (EXISTENTE — REUTILIZAR para Lead GANHO)
│   │   ├── useNotifications.ts    # (EXISTENTE — REUTILIZAR)
│   │   └── use-crm-stream.ts      # <<< NOVO: Hook SSE
│   │
│   └── stores/
│       └── crm-store.ts           # <<< NOVO: Estado Zustand
│
├── workers/                       # <<< NOVO: Workers BullMQ
│   └── crm/
│       ├── index.ts               # Ponto de entrada
│       ├── process-webhook.ts     # Processa webhooks
│       ├── calculate-ai-score.ts  # Pontuação IA
│       ├── golden-window.ts       # Janela de Ouro
│       ├── retention-radar.ts     # Radar de retenção
│       ├── execute-automation.ts  # Executor de automação
│       └── reconcile-messages.ts  # Reconciliação de mensagens
│
├── actions/                       # <<< NOVO: Ações do Servidor
│   └── crm/
│       ├── move-lead.ts           # Mover lead entre estágios
│       ├── send-message.ts        # Enviar mensagem WhatsApp
│       └── mark-clinical-media.ts # Marcar mídia clínica
│
├── prisma/
│   ├── schema.prisma              # ADICIONAR CRM ao FINAL
│   └── seeds/
│       └── crm-pipeline.ts        # <<< NOVO: Semente do pipeline
│
├── middleware.ts                   # ALTERAR COM CUIDADO (apenas adicionar rotas)
├── docker-compose.yml             # ADICIONAR Redis + Evolution API
└── package.json                   # ADICIONAR novas dependências
```

---

## 5. SCHEMA PRISMA EXISTENTE (27 Models — NÃO ALTERAR)

```
User  EmailVerificationToken  Service  PackageOption  Package
Appointment  Schedule  BlockedDate  Payment  Expense
BodyMeasurement  SessionFeedback  CareGuideline  Anamnese
ReferralCode  Referral  LoyaltyPoints  LoyaltyTransaction  LoyaltyReward
InventoryItem  StockMovement  Waitlist  GiftCard  TreatmentProtocol
SiteSettings  DigitalReceipt  GalleryImage
```

**Padrão de autenticação REAL (verificado em src/lib/auth.ts):**
```typescript
// verifyToken(token) → { userId: string, email: string, role: string } | null
// Papéis: 'ADMIN' | 'PATIENT'
// Todas as rotas CRM exigem role === 'ADMIN'
```

**Cliente Prisma REAL (verificado em src/lib/prisma.ts):**
```typescript
// Usa @prisma/adapter-pg com driver nativo `pg`
// Pool de conexões via new Pool()
// Importar: import { prisma } from '@/lib/prisma'
```

---

## 6. SCHEMA CRM COMPLETO

> **ADICIONAR AO FINAL do `prisma/schema.prisma`. NÃO alterar NADA acima.**

```prisma
// ============================================================
// MÓDULO CRM v8.0 — ZERO LACUNAS
// Adicionar ao FINAL do schema.prisma.
// NÃO alterar NADA acima desta linha.
// ============================================================

enum LeadStatus   { COLD WARM HOT WON LOST }
enum StageType    { OPEN WON LOST }
enum CrmMessageType {
  TEXT IMAGE AUDIO VIDEO DOCUMENT TEMPLATE SYSTEM_LOG
}
enum AutomationTrigger {
  NEW_MESSAGE_RECEIVED LEAD_STAGE_CHANGED LEAD_CREATED
  CONTACT_IDLE APPOINTMENT_BOOKED APPOINTMENT_COMPLETED
}

model CrmTenant {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  createdAt DateTime @default(now())

  pipelines     Pipeline[]
  leads         Lead[]
  channels      CrmChannel[]
  conversations Conversation[]
  automations   CrmAutomation[]
  integrations  CrmIntegration[]
  auditLogs     CrmAuditLog[]
  knowledgeBase CrmKnowledgeBase[]
}

model CrmIntegration {
  id          String   @id @default(cuid())
  tenantId    String
  provider    String
  credentials Json
  isActive    Boolean  @default(true)
  settings    Json?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tenant CrmTenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, provider])
  @@index([tenantId, isActive])
}

model CrmAuditLog {
  id        String   @id @default(cuid())
  tenantId  String
  userId    String
  action    String
  entityId  String?
  details   Json?
  ipAddress String?
  createdAt DateTime @default(now())

  tenant CrmTenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId, createdAt(sort: Desc)])
  @@index([tenantId, userId])
  @@index([tenantId, action])
}

model CrmKnowledgeBase {
  id         String   @id @default(cuid())
  tenantId   String
  title      String
  content    String   @db.Text
  embedding  Unsupported("vector(1536)")?
  chunkIndex Int      @default(0)
  sourceFile String?
  isActive   Boolean  @default(true)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  tenant CrmTenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([tenantId, sourceFile])
}

model Pipeline {
  id        String   @id @default(cuid())
  tenantId  String
  name      String
  isDefault Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tenant CrmTenant @relation(fields: [tenantId], references: [id])
  stages Stage[]
  leads  Lead[]

  @@index([tenantId])
}

model Stage {
  id         String    @id @default(cuid())
  pipelineId String
  tenantId   String
  name       String
  type       StageType @default(OPEN)
  order      Int
  cachedLeadCount  Int      @default(0)
  cachedTotalValue Float    @default(0)
  cacheUpdatedAt   DateTime?
  color      String?
  createdAt  DateTime  @default(now())

  pipeline Pipeline @relation(fields: [pipelineId], references: [id], onDelete: Cascade)
  leads    Lead[]

  @@index([pipelineId])
  @@index([tenantId])
}

model Lead {
  id         String     @id @default(cuid())
  tenantId   String
  pipelineId String
  stageId    String
  status     LeadStatus @default(WARM)

  name   String
  phone  String
  email  String?
  source String?
  tags   String[]

  position      Float  @default(0)
  expectedValue Float?

  aiScore      Float?
  aiScoreLabel String?
  churnRisk    Float?

  bestContactDays  String?
  bestContactHours String?
  bestContactBasis Int?

  lastInteractionAt DateTime?
  lostReason        String?
  deletedAt         DateTime?

  patientId           String?
  linkedAppointmentId String?

  pipeline      Pipeline       @relation(fields: [pipelineId], references: [id])
  stage         Stage          @relation(fields: [stageId], references: [id])
  tenant        CrmTenant      @relation(fields: [tenantId], references: [id])
  conversations Conversation[]
  activities    LeadActivity[]

  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  closedAt  DateTime?

  @@index([tenantId, stageId, position])
  @@index([tenantId, status])
  @@index([tenantId, deletedAt])
  @@index([tenantId, lastInteractionAt])
  @@index([tenantId, phone])
}

model LeadActivity {
  id        String   @id @default(cuid())
  leadId    String
  type      String
  payload   Json
  createdBy String?
  createdAt DateTime @default(now())

  lead Lead @relation(fields: [leadId], references: [id], onDelete: Cascade)

  @@index([leadId, createdAt])
}

model CrmChannel {
  id          String   @id @default(cuid())
  tenantId    String
  type        String
  name        String
  instanceId  String?
  credentials Json?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())

  tenant        CrmTenant      @relation(fields: [tenantId], references: [id])
  conversations Conversation[]

  @@index([tenantId])
}

model Conversation {
  id               String   @id @default(cuid())
  tenantId         String
  leadId           String
  channelId        String
  remoteJid        String
  unreadCount      Int      @default(0)
  isClosed         Boolean  @default(false)
  lastMessageAt    DateTime @default(now())
  assignedToUserId String?

  tenant   CrmTenant  @relation(fields: [tenantId], references: [id])
  lead     Lead       @relation(fields: [leadId], references: [id], onDelete: Cascade)
  channel  CrmChannel @relation(fields: [channelId], references: [id])
  messages Message[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([tenantId, remoteJid])
  @@index([tenantId, isClosed, lastMessageAt(sort: Desc)])
  @@index([leadId])
}

model Message {
  id             String         @id @default(cuid())
  conversationId String
  tenantId       String
  waMessageId    String         @unique

  fromMe        Boolean
  type          CrmMessageType @default(TEXT)
  content       String         @db.Text
  mediaMimeType String?
  mediaUrl      String?

  isClinicalMedia Boolean @default(false)

  status String    @default("SENT")
  readAt DateTime?

  sentByUserId String?
  sentiment    String?
  aiSummary    String?

  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  createdAt    DateTime     @default(now())

  @@index([conversationId, createdAt(sort: Desc)])
  @@index([tenantId, isClinicalMedia])
  @@index([tenantId])
}

model CrmAutomation {
  id       String            @id @default(cuid())
  tenantId String
  name     String
  trigger  AutomationTrigger
  flowJson Json
  isActive Boolean           @default(false)

  tenant CrmTenant @relation(fields: [tenantId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([tenantId, trigger, isActive])
}
```

---

## 7. INFRAESTRUTURA BASE

### 7.1 — `src/lib/crypto.ts` — Criptografia AES-256-GCM

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex')

export function encryptCredentials(data: Record<string, unknown>): string {
  const iv = randomBytes(16)
  const cipher = createCipheriv(ALGORITHM, KEY, iv)
  const json = JSON.stringify(data)
  const encrypted = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':')
}

export function decryptCredentials(ciphertext: string): Record<string, unknown> {
  const [ivHex, authTagHex, dataHex] = ciphertext.split(':')
  const decipher = createDecipheriv(ALGORITHM, KEY, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ])
  return JSON.parse(decrypted.toString('utf8'))
}
```

### 7.2 — Extensão do `src/lib/prisma.ts` — Helper pgvector

```typescript
// ADICIONAR ao arquivo existente (NÃO substituir o que já existe):
export async function findSimilarChunks(
  tenantId: string,
  embedding: number[],
  limit = 5,
  threshold = 0.75
) {
  return prisma.$queryRaw<Array<{
    id: string; title: string; content: string; similarity: number
  }>>`
    SELECT id, title, content,
           1 - (embedding <=> ${embedding}::vector) AS similarity
    FROM   "CrmKnowledgeBase"
    WHERE  "tenantId" = ${tenantId}
      AND  "isActive" = true
      AND  embedding IS NOT NULL
      AND  1 - (embedding <=> ${embedding}::vector) > ${threshold}
    ORDER  BY similarity DESC
    LIMIT  ${limit}
  `
}
```

### 7.3 — `src/lib/evolution-api.ts` — Cliente da Evolution API

```typescript
interface ResultadoBuscaMensagens {
  messages: Array<{
    key: { id: string; fromMe: boolean; remoteJid: string }
    message: unknown
  }>
}

async function requisicao<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
  const res = await fetch(`${process.env.EVOLUTION_API_URL}${caminho}`, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      'apikey': process.env.EVOLUTION_API_KEY!,
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
    signal: AbortSignal.timeout(8_000),
  })
  if (!res.ok) throw new Error(`Evolution API ${res.status}: ${caminho}`)
  return res.json()
}

export const evolutionApi = {
  enviarTexto: (instanceId: string, remoteJid: string, texto: string) =>
    requisicao('POST', `/message/sendText/${instanceId}`, {
      number: remoteJid, text: texto, delay: 1200,
    }),
  enviarTemplate: (instanceId: string, remoteJid: string, template: string, variaveis: string[]) =>
    requisicao('POST', `/message/sendTemplate/${instanceId}`, {
      number: remoteJid, name: template, language: { code: 'pt_BR' },
      components: [{ type: 'body', parameters: variaveis.map(v => ({ type: 'text', text: v })) }],
    }),
  buscarMensagens: (instanceId: string, quantidade = 50) =>
    requisicao<ResultadoBuscaMensagens>('GET', `/chat/fetchMessages/${instanceId}?count=${quantidade}`),
  marcarComoLida: (instanceId: string, idsMsg: string[]) =>
    requisicao('POST', `/message/markMessageAsRead/${instanceId}`, {
      read_messages: idsMsg.map(id => ({ id, fromMe: false, remote: '' }))
    }),
}
```

### 7.4 — `src/lib/queues/index.ts` — BullMQ (versão gratuita)

```typescript
import { Queue, QueueEvents } from 'bullmq'
import IORedis from 'ioredis'

export const redis = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
})

const opcoesPadrao = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 1_000 },
  removeOnComplete: { count: 200 },
  removeOnFail: false,
}

export const filaEntrada    = new Queue('inbox',      { connection: redis, defaultJobOptions: opcoesPadrao })
export const filaAutomacao  = new Queue('automation', { connection: redis, defaultJobOptions: opcoesPadrao })
export const filaIA         = new Queue('ai',         { connection: redis, defaultJobOptions: { ...opcoesPadrao, attempts: 2 } })
export const filaAgendador  = new Queue('scheduler',  { connection: redis })
export const filaDLQ        = new Queue('dlq',        { connection: redis, defaultJobOptions: { attempts: 1 } })

export async function moverParaDLQ(params: {
  filaOriginal: string; jobId: string; motivo: string; payload: unknown
}) {
  await filaDLQ.add('dead-job', { ...params, falhouEm: new Date().toISOString() })
}

export function anexarOuvinteDLQ(queue: Queue) {
  const eventos = new QueueEvents(queue.name, { connection: redis })
  eventos.on('failed', async ({ jobId, failedReason }) => {
    const job = await queue.getJob(jobId)
    const maxTentativas = job?.opts?.attempts ?? 3
    if (job && job.attemptsMade >= maxTentativas) {
      await moverParaDLQ({ filaOriginal: queue.name, jobId, motivo: failedReason, payload: job.data })
    }
  })
}
```

### 7.5 — `src/lib/audit.ts` — Log de Auditoria LGPD

```typescript
import { prisma } from '@/lib/prisma'

interface ParametrosAuditoria {
  tenantId: string; userId: string; acao: string
  entityId?: string; detalhes?: Record<string, unknown>
}

export async function criarLogAuditoria(params: ParametrosAuditoria) {
  void prisma.crmAuditLog.create({
    data: {
      tenantId: params.tenantId, userId: params.userId,
      action: params.acao, entityId: params.entityId,
      details: params.detalhes,
    }
  }).catch(console.error)
}
```

---

## 8. SSE — `/api/crm/stream`

Reutiliza o padrão SSE já existente em `/api/gps/stream` (30s heartbeat, ReadableStream, abort cleanup).
Diferença: usa Redis pub/sub ao invés de store em memória.

---

## 9. WEBHOOK HANDLER

```
Arquivo: app/api/webhooks/evolution/route.ts
LEMBRETE: OBRIGATÓRIO adicionar '/api/webhooks/evolution' ao PUBLIC_PATHS no middleware.ts
```

---

## 10. WORKERS CRM

> Workers rodam como processo separado: `npx tsx workers/crm/index.ts`

Arquivos em `workers/crm/`:
- `index.ts` — Ponto de entrada com 4 workers (entrada, automação, IA, agendador)
- `process-webhook.ts` — Processa webhooks da Evolution API
- `calculate-ai-score.ts` — Pontuação IA (0-100) sem LLM, custo zero
- `golden-window.ts` — Melhor dia/hora para contato baseado em padrão estatístico
- `retention-radar.ts` — Risco de churn por ciclo biológico do procedimento
- `execute-automation.ts` — Executa DAG de automação nó a nó
- `reconcile-messages.ts` — Reconcilia mensagens perdidas com a Evolution API

---

## 11. PIPELINE RAG — MÓDULO 5

```
Arquivo: src/lib/rag.ts
IMPORTANTE: PDFs usam pdf-parse (binário), NUNCA file.text()
Dependências: npm i pdf-parse @types/pdf-parse openai
```

---

## 12. LGPD: AUDIT LOG + ANONIMIZAÇÃO

```
Arquivo: src/lib/lgpd.ts
anonymizeLead() — Artigo 18 da LGPD (Direito ao Esquecimento)
NÃO deleta registros — preserva integridade histórica de relatórios financeiros
Anonimiza: nome, telefone, e-mail, tags, fonte
```

---

## 13. COFRE DE MÍDIA

- Passar o mouse em mídia → "+ Prontuário" → `isClinicalMedia: true`
- Log de auditoria em `VIEW_PATIENT_MEDIA`
- Consulta: `prisma.message.findMany({ where: { conversation: { leadId }, isClinicalMedia: true } })`

---

## 14. UX PREMIUM

### Variáveis CSS (adicionar ao globals.css — NÃO substituir existente)

```css
:root {
  --crm-bg: #0A0A0B;
  --crm-surface: #111114;
  --crm-surface-2: #1A1A1F;
  --crm-border: #2A2A32;
  --crm-gold: #D4AF37;
  --crm-gold-subtle: rgba(212,175,55,0.12);
  --crm-text: #F0EDE8;
  --crm-text-muted: #8B8A94;
  --crm-hot: #FF6B4A;
  --crm-warm: #F0A500;
  --crm-cold: #4A7BFF;
  --crm-won: #2ECC8A;
}
```

**Tipografia:** Cormorant Garamond (títulos) + DM Sans (interface)
**Bordas arredondadas:** 12px cards, 8px inputs, 6px badges
**Sombras:** `0 4px 24px rgba(0,0,0,0.4)` em repouso, `0 25px 50px rgba(0,0,0,0.45)` no hover
**Transições:** Física de mola via Framer Motion (`stiffness: 400, damping: 25, mass: 1.2`)

---

## 15. ROTEIRO DE 5 MÓDULOS

| Módulo | Descrição | Dependências |
|---|---|---|
| 1. Funil Kanban | Pipeline + Estágios + Arrasta e Solta | Schema CRM + índice fracionário |
| 2. Caixa de Entrada + Evolution API | WhatsApp bidirecional | Webhook + Workers + SSE |
| 3. IA (Pontuação + Janela de Ouro) | Workers assíncronos | filaIA + Redis |
| 4. Automações | Construtor visual React Flow | filaAutomação + execute-automation |
| 5. RAG + Concierge | Base de conhecimento + IA | OpenAI + pgvector |

---

## 16. INTERFACE DLQ ADMIN

```
Rota: /admin/crm/system/dlq/page.tsx — Componente de Servidor
Lista jobs falhos da filaDLQ
Botão "Reenfileirar" por job
```

---

## 17. PADRÕES DE CÓDIGO OBRIGATÓRIOS

```typescript
// ✅ SEMPRE FAZER:
// - Componentes de Servidor por padrão — "use client" apenas nas folhas
// - Ações do Servidor para mutações (nunca Rotas de API para consumo interno)
// - useOptimistic para arrasta e solta e ações imediatas
// - Zod em toda Ação do Servidor que receba entrada externa
// - prisma.$transaction para operações multi-tabela
// - criarLogAuditoria() em ações sensíveis
// - encryptCredentials() para CrmIntegration.credentials
// - anonymizeLead() em vez de DELETE para LGPD
// - SEMPRE filtrar deletedAt: null em consultas de Lead
// - Padrão anti-N+1: 2 consultas + agrupamento em TypeScript
// - TypeScript estrito: zero `any`, zero `as unknown`, zero `!` desnecessário
// - Nenhum `console.log` em produção — apenas `console.error` em catch
// - Comentários explicam o PORQUÊ (regra de negócio), nunca o O QUÊ

// ❌ NUNCA FAZER:
// - NUNCA alterar: Appointment, User, Payment, Package, Service, Schedule
// - NUNCA /api/webhooks/* sem PUBLIC_PATHS no middleware
// - NUNCA COUNT/SUM no carregamento do Kanban — usar cachedLeadCount
// - NUNCA `order Int` para cards — usar `position Float`
// - NUNCA credenciais em texto puro
// - NUNCA conversationId = 'PENDING'
// - NUNCA file.text() em PDF — usar pdf-parse
// - NUNCA upsertJobScheduler (BullMQ Pro) — usar repeat.pattern
// - NUNCA exclusão definitiva de Lead — usar anonymizeLead()
// - NUNCA `any` ou `as unknown`
// - NUNCA `// @ts-ignore` ou `// @ts-expect-error`
```

---

## 18. VARIÁVEIS DE AMBIENTE

```env
# === NOVAS (CRM) — Adicionar ao .env ===

# Criptografia: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=

# Evolution API
EVOLUTION_API_URL=http://evolution:8080
EVOLUTION_API_KEY=
EVOLUTION_WEBHOOK_SECRET=

# Redis (BullMQ + SSE Pub/Sub)
REDIS_URL=redis://redis:6379

# OpenAI (embeddings + Concierge RAG)
OPENAI_API_KEY=

# Multi-tenancy V1
DEFAULT_TENANT_ID=clinica-mykaele-procopio

# Radar de Retenção
RETENTION_RADAR_CRON="0 8 * * *"
RETENTION_RISK_THRESHOLD=70

# S3 (mídias WhatsApp)
S3_ENABLED=false
S3_BUCKET=
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_ENDPOINT=
```

---

## 19. CONTEXTO DE NEGÓCIO

**Tempos por procedimento (usados no Radar + Automações):**
```
Botox                → Acompanhamento: 15d  | Retorno: 120d
Preenchimento Labial → Acompanhamento: 7d   | Retorno: 270d
Harmonização Facial  → Acompanhamento: 15d  | Retorno: 180d
Bioestimuladores     → Acompanhamento: 30d  | Retorno: 180d
Skinbooster          → Acompanhamento: 7d   | Retorno: 90d
Peeling Químico      → Acompanhamento: 7d   | Retorno: 90d
Microagulhamento     → Acompanhamento: 30d  | Retorno: 90d
```

---

## 20. COMANDOS ÚTEIS

```bash
# 1. Gerar ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 2. Instalar dependências novas (NÃO remove existentes)
npm i bullmq ioredis openai pdf-parse @hello-pangea/dnd @xyflow/react zustand framer-motion gsap
npm i -D @types/pdf-parse

# 3. Configurar pgvector (UMA VEZ, antes da migration)
psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS vector;"

# 4. Migration CRM
npx prisma migrate dev --name add_crm_module

# 5. Semente do pipeline
npx tsx prisma/seeds/crm-pipeline.ts

# 6. Worker (processo separado)
npx tsx workers/crm/index.ts

# 7. Evolution API (docker)
docker-compose -f docker/evolution-api/docker-compose.yml up -d
```

---

## 21. PROTOCOLO DE AUDITORIA PRÉ-CÓDIGO

> **OBRIGATÓRIO:** Antes de escrever qualquer linha de código, execute este protocolo.

### Arquivos para ler e analisar NESTA ORDEM:
1. `CLAUDE.md` — Blueprint arquitetural completo
2. `middleware.ts` — Mapear TODAS as rotas protegidas e públicas
3. `prisma/schema.prisma` — Todos os 27+ models existentes
4. `src/lib/auth.ts` — Payload exato do verifyToken
5. `next.config.ts` — Configurações globais e CSP
6. `package.json` — Dependências instaladas
7. Todo o diretório `app/` — Rotas, layouts, providers existentes
8. Todo o diretório `src/lib/` — Utilitários, clientes, helpers
9. Todo o diretório `src/components/` — Componentes e design system atual
10. `docker-compose.yml` — Serviços em produção
11. `.env.example` — Variáveis já configuradas

### Relatório obrigatório antes de codar:

**A) MAPA DE RISCO**
- Quais arquivos são intocáveis (produção ativa)
- Quais rotas precisam de atenção no middleware
- Quais models do Prisma têm relações que podem conflitar com o CRM
- Dependências que já existem vs. as que precisam ser instaladas

**B) LACUNAS DO PROJETO**
- O que está descrito no CLAUDE.md mas ainda não existe no código
- Ordem de implementação sem risco de regressão

**C) DESIGN SYSTEM ATUAL**
- Quais componentes, fontes, cores e padrões visuais já existem
- O que pode ser reaproveitado no CRM

---

## 22. PADRÃO DE DESIGN: SILICON VALLEY TIER 1

O CRM deve ter UI/UX de aplicativo nativo Apple.
Referências visuais: Linear, Vercel Dashboard, Stripe, Raycast, Loom.

### Cores obrigatórias (modo escuro forçado):
```css
--crm-bg:          #0A0A0B;   /* Fundo principal */
--crm-surface:     #111114;   /* Cards e painéis */
--crm-surface-2:   #1A1A1F;   /* Hover e elevação */
--crm-border:      #2A2A32;   /* Bordas */
--crm-gold:        #D4AF37;   /* Acento premium */
--crm-gold-subtle: rgba(212,175,55,0.12);
--crm-text:        #F0EDE8;   /* Branco quente */
--crm-text-muted:  #8B8A94;
--crm-hot:         #FF6B4A;   /* Lead quente */
--crm-warm:        #F0A500;   /* Lead morno */
--crm-cold:        #4A7BFF;   /* Lead frio */
--crm-won:         #2ECC8A;   /* Lead ganho */
```

### Padrões visuais inegociáveis:
- **Tipografia:** Cormorant Garamond (títulos) + DM Sans (interface)
- **Bordas arredondadas:** 12px cards, 8px inputs, 6px badges
- **Sombras:** `0 4px 24px rgba(0,0,0,0.4)` repouso, `0 25px 50px rgba(0,0,0,0.45)` hover
- **Transições:** Física de mola via Framer Motion (`stiffness: 400, damping: 25, mass: 1.2`)
- **Carregamento:** Esqueleto animado — nunca spinner genérico
- **Estado vazio:** Ilustração contextual — nunca "Nenhum resultado" sem arte
- **Micro-feedback:** Sons (volume 12%) + API de Vibração no mobile
- **Glassmorphism:** `backdrop-filter: blur(20px)` + `bg-white/5` em modais

### Anatomia do card de Lead (obrigatória):
```
┌──────────────────────────────────────┐
│ [Temperatura] [Avatar] Nome   [HOT]  │
│                                      │
│ [Tag procedimento] [Tag segmento]    │
│                                      │
│ 💎 R$ valor        ⭐ aiScore/100    │
│                                      │
│ ⏰ Janela de Ouro: Dia · Horário     │
│    Base: N conversões                │
│                                      │
│ 🕐 Há X dias · Fonte                │
└──────────────────────────────────────┘
```

### O que torna superior ao Kommo:
- Kommo é genérico. Cada pixel aqui é estética de luxo.
- Física real no arrasta e solta — card tem peso, inclina 1.5°, sombra profunda
- Cards vizinhos desfocam durante arraste (blur 1.5px, opacity 0.4)
- Cabeçalhos de coluna: "12 leads · R$ 48.500" em tempo real (cache no banco)
- Painel lateral do chat: LTV, pacotes ativos, faltas, fotos clínicas
- Janela de Ouro: melhor dia/hora baseado em padrão estatístico (único no mercado)
- Concierge RAG: IA sugere resposta baseada nos protocolos reais da clínica
- Radar de Retenção: alerta quando paciente some após ciclo biológico do procedimento

---

## 23. FASES DE IMPLEMENTAÇÃO

### FASE 0 — DEPENDÊNCIAS (zero impacto no site)
```bash
npm i @hello-pangea/dnd framer-motion bullmq ioredis pdf-parse zustand @xyflow/react
npm i -D @types/pdf-parse
```
Criar arquivos de biblioteca sem dependências:
- `src/lib/crypto.ts`
- `src/lib/fractional-index.ts`
- `src/lib/crm-animations.ts`
- `src/lib/crm-feedback.ts`

### FASE 1 — BANCO DE DADOS (migration aditiva)
- Adicionar Schema CRM ao FINAL do `schema.prisma`
- `npx prisma migrate dev --name add_crm_module`
- Adicionar `findSimilarChunks()` ao `src/lib/prisma.ts`

### FASE 2 — BACKEND (arquivos novos, zero impacto)
- `src/lib/queues/index.ts`
- `src/lib/queues/scheduler.ts`
- `src/lib/evolution-api.ts`
- `src/lib/audit.ts`
- `src/lib/lgpd.ts`
- `src/lib/rag.ts`

### FASE 3 — MIDDLEWARE (única alteração em arquivo existente)
- Adicionar `'/api/webhooks/evolution'` ao `PUBLIC_PATHS`
- Adicionar `'/api/crm/stream'` ao `PUBLIC_PREFIXES`

### FASE 4 — ROTAS + PÁGINAS (arquivos novos)
- `app/api/webhooks/evolution/route.ts`
- `app/api/crm/stream/route.ts`
- `app/admin/crm/layout.tsx` (com sub-navegação)
- `app/admin/crm/pipeline/page.tsx` (Kanban — Módulo 1)
- Adicionar "CRM" ao array NAV no `app/admin/layout.tsx`

### FASE 5 — WORKERS (processo separado)
- `workers/crm/*.ts`
- `prisma/seeds/crm-pipeline.ts`
- Docker: Redis + Evolution API

### FASE 6 — MÓDULOS INCREMENTAIS
- Módulo 2: Caixa de Entrada
- Módulo 3: IA (Pontuação + Janela de Ouro)
- Módulo 4: Automações
- Módulo 5: RAG + Concierge

---

## 24. PROTOCOLO DE ENTREGA

Para cada funcionalidade solicitada, entregar SEMPRE nesta estrutura:

### 1. ANÁLISE PRÉ-CÓDIGO
- Risco de regressão: [nenhum / baixo / médio — justificar]
- Arquivos que serão alterados
- Arquivos que serão criados
- Migration necessária? [sim/não]

### 2. CÓDIGO COMPLETO
- Sem marcadores de posição, sem `// TODO`, sem `...rest`
- Pronto para copiar e executar
- Tipos TypeScript completos
- Tratamento de carregamento, estado vazio e estado de erro

### 3. LISTA DE VERIFICAÇÃO PÓS-IMPLEMENTAÇÃO
- Comando para executar (migration, semente, etc.)
- O que testar manualmente
- O que pode impactar em produção

---

## REGRAS DE OURO PARA TODO CÓDIGO

```typescript
// ✅ SEMPRE
where: { deletedAt: null }                    // em toda consulta de Lead
prisma.$transaction([...])                    // em toda operação multi-tabela
useOptimistic                                 // em toda mutação do Kanban
verifyToken + role === 'ADMIN'                // em toda rota CRM

// ❌ NUNCA
include: { leads: true }                      // N+1
conversationId: 'PENDING'                     // registro inválido
file.text() em PDF                            // binário corrompido — usar pdf-parse
upsertJobScheduler                            // BullMQ Pro — usar repeat.pattern
alterar Appointment / User / Payment          // INTOCÁVEIS
criar /api/webhooks/* sem publicRoutes        // retorna 401 em produção
```

---

## PRÓXIMA AÇÃO IMEDIATA

```
1. Gerar ENCRYPTION_KEY e adicionar ao .env
2. npm i bullmq ioredis openai pdf-parse @hello-pangea/dnd @xyflow/react zustand framer-motion gsap
3. psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS vector;"
4. Adicionar Schema CRM ao FINAL do schema.prisma
5. npx prisma migrate dev --name add_crm_module
6. Criar arquivos na ORDEM (dependências entre eles):
   src/lib/crypto.ts           ← sem dependências
   src/lib/evolution-api.ts    ← sem dependências
   src/lib/fractional-index.ts ← sem dependências
   src/lib/crm-animations.ts   ← sem dependências
   src/lib/crm-feedback.ts     ← sem dependências
   src/lib/queues/index.ts     ← depende de ioredis
   src/lib/queues/scheduler.ts ← depende de queues/index
   src/lib/audit.ts            ← depende de prisma
   src/lib/rag.ts              ← depende de prisma + openai
   src/lib/lgpd.ts             ← depende de prisma + audit
7. ANTES do Módulo 2: adicionar '/api/webhooks/evolution' ao PUBLIC_PATHS
8. Implementar /admin/crm/pipeline (Módulo 1)
```

---

## 25. LIÇÕES OPERACIONAIS (Produção)

> Documentação de problemas encontrados e soluções aplicadas em produção.
> Atualizado: 14/03/2026

### 25.1 — WhatsApp LID (@lid)

O WhatsApp migrou alguns contatos para o formato **Linked ID** (`@lid`) em vez do tradicional `@s.whatsapp.net`.

**Impacto:** remoteJid como `122715923083278@lid` não é número de telefone — é um ID interno.

**Arquivos que DEVEM tratar @lid:**
- `src/lib/evolution-api.ts` — `normalizeNumber()` mantém JID completo para @lid
- `app/api/crm/sync-messages/route.ts` — filtro aceita @lid, phone extraction remove @lid
- `src/lib/webhook-processor.ts` — phone extraction remove @lid
- `src/workers/crm/process-webhook.ts` — phone extraction remove @lid

**Regra:** Ao adicionar QUALQUER código que manipule `remoteJid`, SEMPRE tratar os 3 formatos:
```typescript
phone = remoteJid.replace('@s.whatsapp.net', '').replace('@c.us', '').replace('@lid', '')
```

### 25.2 — Evolution API: webhookByEvents

A Evolution API pode operar com `webhookByEvents: true`, enviando webhooks para sub-paths:
- `/api/webhooks/evolution/messages-upsert`
- `/api/webhooks/evolution/connection-update`
- `/api/webhooks/evolution/qrcode-updated`

**Solução:** Rota catch-all em `app/api/webhooks/evolution/[...slug]/route.ts`

**Middleware:** `/api/webhooks/evolution` está em `PUBLIC_PREFIXES` (não `PUBLIC_PATHS`) para cobrir sub-paths.

**NUNCA** mover de volta para PUBLIC_PATHS — quebraria os webhooks.

### 25.3 — Race Condition: Auto-Reply Duplicado

Quando webhook E polling processam a mesma mensagem simultaneamente, ambos podem disparar o auto-reply.

**Solução:** `markAutoReplySent()` é chamado ANTES do delay e envio (lock otimista).

```typescript
// ✅ CORRETO — marcar antes de enviar
await markAutoReplySent(leadId, message)
await delay(config.delayMs)
await evolutionApi.sendText(...)

// ❌ ERRADO — janela de race condition durante o delay
await delay(config.delayMs)
await evolutionApi.sendText(...)
await markAutoReplySent(leadId, message) // tarde demais
```

### 25.4 — Polling: Limites da Evolution API

A Evolution API em VPS compartilhada tem capacidade limitada. O `findMessages` pode levar >12s por chat.

**Configuração atual (otimizada):**
| Parâmetro | Antes | Depois |
|---|---|---|
| Chats por ciclo | 20 | 5 |
| Timeout findMessages | 12s | 6s |
| Intervalo polling | 20s | 30s |

**Regra:** O polling é FALLBACK. O mecanismo principal são os webhooks.

### 25.5 — VPS: Espaço em Disco

Docker acumula imagens de builds antigos. Limpar periodicamente:

```bash
# No terminal do Coolify (Server > Terminal)
docker system prune -a --volumes -f
```

### 25.6 — Variáveis de Ambiente: Gemini API Key

A key do Gemini é usada em 3 lugares:
1. **Banco (CrmIntegration)** — salva pela UI de configurações, lida pelo `test-ai` e `ai-agent`
2. **process.env.GEMINI_API_KEY** — usada por `smart-replies` e `concierge` diretamente
3. **.env local** — desenvolvimento apenas

**IMPORTANTE:** Ao trocar a key, atualizar nos 3 lugares:
- UI do CRM → Configurações → IA → colar nova key → Salvar
- Coolify → Environment Variables → GEMINI_API_KEY → Update
- .env local (para dev)

Após alterar no Coolify, é OBRIGATÓRIO fazer redeploy (variáveis são injetadas no build).

---

*CLAUDE.md v8.0 (Português Completo + Regras de Implementação) — Março 2026*
*Inclui: Protocolo de auditoria, padrão de design, fases de implementação, protocolo de entrega*
