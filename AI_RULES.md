# AI_RULES.md — Regras de Desenvolvimento para IA
> Regras obrigatórias para qualquer IA (Claude, Cursor, Copilot) trabalhando neste projeto.
> Versão: 2.0 (Português Completo) — Março 2026
> **LEIA TUDO ANTES DE ESCREVER QUALQUER LINHA DE CÓDIGO.**

---

## REGRA #1: NÃO QUEBRAR O SITE EXISTENTE

O site já está em produção. Qualquer alteração CRM deve ser **aditiva**.
Antes de cada funcionalidade, pergunte: "Isso pode quebrar algo que já funciona?"

### Arquivos PROIBIDOS de alterar (a menos que explicitamente pedido):
```
src/lib/auth.ts           # Autenticação JWT — funciona em produção
src/lib/prisma.ts         # Cliente Prisma — funciona (apenas ADICIONAR helpers, nunca substituir)
src/lib/mercadopago.ts    # Pagamentos Mercado Pago — funciona em produção
src/lib/whatsapp.ts       # CallMeBot — funciona em produção
src/lib/email.ts          # Resend — funciona em produção
src/lib/rate-limit.ts     # Limite de taxa — funciona em produção
src/lib/media-catalog.ts  # Catálogo de mídia — funciona em produção
app/layout.tsx            # Layout raiz com SEO, PWA, GA4, Meta Pixel
app/globals.css           # 615 linhas de animações (apenas ADICIONAR variáveis CRM)
next.config.ts            # CSP, HSTS, CORS (apenas ADICIONAR domínios se necessário)
```

### Models Prisma PROIBIDOS de alterar:
```
User, Appointment, Service, Package, PackageOption, Schedule,
BlockedDate, Payment, Expense, BodyMeasurement, SessionFeedback,
CareGuideline, Anamnese, ReferralCode, Referral, LoyaltyPoints,
LoyaltyTransaction, LoyaltyReward, InventoryItem, StockMovement,
Waitlist, GiftCard, TreatmentProtocol, SiteSettings,
DigitalReceipt, GalleryImage, EmailVerificationToken
```

### Rotas existentes PROIBIDAS de alterar:
```
app/admin/agenda/         # Agendamentos — produção ativa
app/admin/clientes/       # Clientes — produção ativa
app/admin/financeiro/     # Financeiro — produção ativa
app/admin/fidelidade/     # Fidelidade — produção ativa
app/admin/estoque/        # Estoque — produção ativa
app/admin/rastreamento/   # GPS — produção ativa
app/api/auth/             # Autenticação — produção ativa
app/api/payments/         # Pagamentos — produção ativa
app/api/gps/              # GPS SSE — produção ativa
app/api/appointments/     # Agendamentos — produção ativa
app/api/patient/          # Portal do paciente — produção ativa
```

---

## REGRA #2: ONDE COLOCAR CÓDIGO CRM

```
CÓDIGO CRM NOVO vai em:
  app/admin/crm/             # Páginas CRM (Kanban, Caixa de Entrada, etc.)
  app/api/crm/               # APIs CRM (stream, leads, etc.)
  app/api/webhooks/          # Webhook Evolution API
  src/lib/crypto.ts          # Criptografia AES-256-GCM
  src/lib/evolution-api.ts   # Cliente Evolution API
  src/lib/audit.ts           # Log de auditoria LGPD
  src/lib/rag.ts             # RAG + embeddings
  src/lib/lgpd.ts            # Anonimização
  src/lib/queues/            # Filas BullMQ
  src/lib/fractional-index.ts
  src/lib/crm-animations.ts
  src/lib/crm-feedback.ts
  src/components/crm/        # Componentes CRM
  src/hooks/use-crm-stream.ts
  src/stores/crm-store.ts    # Estado Zustand
  workers/crm/               # Workers BullMQ (processo separado)
  actions/crm/               # Ações do Servidor CRM
  prisma/seeds/              # Sementes CRM
```

---

## REGRA #3: PADRÕES TYPESCRIPT

```typescript
// OBRIGATÓRIO:
// - TypeScript estrito: zero `any`, zero `as unknown`, zero `!` desnecessário
// - Zod para validação de entradas (Ações do Servidor, APIs)
// - Componentes de Servidor por padrão
// - "use client" APENAS em componentes folha que precisam de interatividade
// - Ações do Servidor para mutações (nunca Rotas de API para consumo interno)
// - useOptimistic para ações que precisam de resposta imediata
// - Nenhum `console.log` em produção — apenas `console.error` em catch
// - Comentários explicam o PORQUÊ (regra de negócio), nunca o O QUÊ

// PROIBIDO:
// - `any` em qualquer lugar
// - `as unknown as X` (conversão insegura)
// - `// @ts-ignore` ou `// @ts-expect-error`
```

---

## REGRA #4: BANCO DE DADOS

```typescript
// OBRIGATÓRIO:
// - prisma.$transaction para operações multi-tabela
// - SEMPRE filtrar `deletedAt: null` em consultas de Lead
// - Exclusão lógica SEMPRE (nunca exclusão definitiva em Lead)
// - Usar `cachedLeadCount` e `cachedTotalValue` (nunca COUNT/SUM no Kanban)
// - `position Float` para ordenação de cards (Índice Fracionário)
// - `waMessageId @unique` para idempotência de mensagens (P2002 = duplicado)
// - Padrão anti-N+1: 2 consultas + agrupamento em TypeScript (nunca include aninhado)

// PROIBIDO:
// - Alterar models existentes (27 models listados na Regra #1)
// - Exclusão definitiva de Lead (usar anonymizeLead)
// - N+1 consultas (include: { leads: true } no pipeline)
// - COUNT/SUM em tempo real no Kanban
// - `order Int` para posição de cards
```

### Exemplo do padrão anti-N+1 (OBRIGATÓRIO para o Kanban):
```typescript
const [stages, leads] = await Promise.all([
  prisma.stage.findMany({ where: { pipelineId }, orderBy: { order: 'asc' } }),
  prisma.lead.findMany({
    where: { pipelineId, deletedAt: null },
    orderBy: { position: 'asc' }
  })
])
const leadsPorEstagio = leads.reduce((acc, lead) => {
  if (!acc[lead.stageId]) acc[lead.stageId] = []
  acc[lead.stageId].push(lead)
  return acc
}, {} as Record<string, typeof leads>)
```

---

## REGRA #5: SEGURANÇA

```typescript
// OBRIGATÓRIO:
// - Verificar verifyToken() em TODA rota CRM
// - role === 'ADMIN' para acesso ao CRM
// - encryptCredentials() antes de salvar credenciais em CrmIntegration
// - criarLogAuditoria() em ações sensíveis (exportar, ver VIP, anonimizar, upload)
// - Validação HMAC no webhook (/api/webhooks/evolution)
// - Limite de taxa no webhook
// - Nunca expor dados sensíveis (telefone, e-mail) sem log de auditoria

// PROIBIDO:
// - Credenciais em texto puro no banco
// - Rota de webhook sem estar em PUBLIC_PATHS do middleware.ts
// - Rotas CRM sem verificação de autenticação
```

---

## REGRA #6: WORKERS E FILAS

```typescript
// OBRIGATÓRIO:
// - BullMQ GRATUITO (não Pro)
// - `repeat.pattern` ou `repeat.every` para tarefas agendadas (cron)
// - DLQ (Fila de Letras Mortas) para jobs falhos
// - Worker como processo SEPARADO do Next.js
// - `jobId: waMessageId` para deduplicação
// - Sempre usar attempts + backoff exponencial

// PROIBIDO:
// - `upsertJobScheduler` (BullMQ Pro — não temos licença)
// - Worker dentro do Next.js (sempre processo separado)
// - Jobs sem retry
// - Ignorar falhas (sempre logar e mover para DLQ)
```

---

## REGRA #7: MIDDLEWARE

O `middleware.ts` protege rotas. Para o CRM funcionar:

```typescript
// ADICIONAR ao PUBLIC_PATHS (correspondência exata):
'/api/webhooks/evolution'

// ADICIONAR ao PUBLIC_PREFIXES (correspondência por prefixo):
'/api/crm/stream'  // SSE não suporta cabeçalho Bearer

// O matcher já cobre '/api/(.*)' então novas rotas /api/crm/* já serão interceptadas.
// Rotas /api/crm/* (exceto stream) precisam de token Bearer via verifyToken().
```

---

## REGRA #8: IMPORTAÇÕES E CAMINHOS

```typescript
// O projeto usa `@/*` como alias que aponta para `src/*`.
// Importações corretas:
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { redis } from '@/lib/queues'

// Para workers (rodam fora do Next.js), usar caminhos relativos
// ou configurar tsconfig separado.
```

---

## REGRA #9: TESTES DE SANIDADE

Antes de fazer merge de qualquer PR do CRM, verificar:

```bash
# 1. Site principal funciona
curl http://localhost:3000/                    # Página inicial carrega
curl http://localhost:3000/api/services        # Serviços retornam

# 2. Autenticação funciona
curl http://localhost:3000/api/auth/login      # Login funciona

# 3. Painel admin funciona
# Abrir /admin no navegador e verificar o painel de controle

# 4. Build passa sem erros
npm run build

# 5. Prisma valida
npx prisma validate
```

---

## REGRA #10: GIT

```bash
# Branches do CRM:
# feature/crm-modulo-1-kanban
# feature/crm-modulo-2-caixa-entrada
# feature/crm-modulo-3-ia
# feature/crm-modulo-4-automacoes
# feature/crm-modulo-5-rag

# Commits em português:
# feat(crm): implementar pipeline kanban
# fix(crm): corrigir arrasta e solta no mobile
# chore(crm): adicionar dependências bullmq + ioredis

# NUNCA fazer force push na main
# NUNCA commitar .env ou credenciais
```

---

## REGRA #11: DESEMPENHO

```typescript
// OBRIGATÓRIO:
// - Padrão anti-N+1: 2 consultas + agrupamento em TypeScript
// - SSE com heartbeat 25s (proxies matam conexões ociosas)
// - Imagens com next/image (carregamento preguiçoso)
// - Componentes de Servidor para busca de dados (sem fetch client-side desnecessário)
// - cachedLeadCount e cachedTotalValue nos cabeçalhos de coluna
// - Índice Fracionário para posição (1 UPDATE por arraste, não N)
```

---

## REGRA #12: DESIGN SYSTEM DO CRM

### Cores (modo escuro obrigatório):
```css
--crm-bg: #0A0A0B;          /* Fundo principal */
--crm-surface: #111114;     /* Cards e painéis */
--crm-surface-2: #1A1A1F;   /* Hover e elevação */
--crm-border: #2A2A32;      /* Bordas */
--crm-gold: #D4AF37;        /* Acento premium (dourado) */
--crm-gold-subtle: rgba(212,175,55,0.12);
--crm-text: #F0EDE8;        /* Branco quente */
--crm-text-muted: #8B8A94;  /* Texto secundário */
--crm-hot: #FF6B4A;         /* Lead quente */
--crm-warm: #F0A500;        /* Lead morno */
--crm-cold: #4A7BFF;        /* Lead frio */
--crm-won: #2ECC8A;         /* Lead ganho */
```

### Tipografia:
- **Títulos:** Cormorant Garamond (serif premium)
- **Interface:** DM Sans (sans-serif limpa)

### Componentes:
- **Bordas arredondadas:** 12px cards, 8px inputs, 6px badges
- **Sombras:** `0 4px 24px rgba(0,0,0,0.4)` repouso, `0 25px 50px rgba(0,0,0,0.45)` hover
- **Transições:** Física de mola via Framer Motion (`stiffness: 400, damping: 25, mass: 1.2`)
- **Carregamento:** Esqueleto animado — nunca spinner genérico
- **Estado vazio:** Ilustração contextual — nunca texto genérico sem arte
- **Sons:** Volume 12%, toque ao pegar card, soltar, ganhar lead, mensagem recebida
- **Vibração:** API de Vibração no mobile (8ms pegar, [15,5,8] soltar, [20,10,20,10,40] ganho)
- **Glassmorphism:** `backdrop-filter: blur(20px)` + `bg-white/5` em modais

### Anatomia do card de Lead (obrigatória):
```
┌──────────────────────────────────────┐
│ [Cor temp] [Avatar] Nome   [QUENTE]  │
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

### Arrasta e solta (obrigatório):
- Card levanta: `scale(1.04)`, `rotate(1.5deg)`, sombra profunda + borda dourada sutil
- Cards vizinhos: `opacity(0.4)` + `blur(1.5px)` + `scale(0.98)`
- Zona de soltar ativa: borda pontilhada dourada pulsando + fundo `rgba(212,175,55,0.04)`
- useOptimistic: UI atualiza ANTES da Ação do Servidor responder

---

## REGRA #13: PROTOCOLO DE ENTREGA

Para CADA funcionalidade solicitada, entregar SEMPRE:

### 1. Análise Pré-Código
- Risco de regressão: [nenhum / baixo / médio — justificar]
- Arquivos que serão alterados
- Arquivos que serão criados
- Migration necessária? [sim/não]

### 2. Código Completo
- Sem `// TODO`, sem `...`, sem marcadores de posição
- Tipos TypeScript explícitos
- Tratamento de carregamento, estado vazio e estado de erro
- Pronto para executar sem modificações

### 3. Lista de Verificação Pós-Implementação
- Comando para executar (migration, semente, etc.)
- O que testar manualmente
- O que pode impactar em produção

---

## REGRA #14: CADEIA DE RACIOCÍNIO

Antes de CADA arquivo CRM, responda mentalmente:

1. **"Isso quebra Agendamento, Pagamento ou GPS?"**
   → Se sim, PARE e repense.

2. **"Escala com `tenantId` para 50 clínicas?"**
   → Se não, adicione tenantId.

3. **"Por que é 10x melhor que o Kommo?"**
   → Se não souber responder, o design precisa melhorar.

4. **"Estou alterando algum arquivo proibido?"**
   → Consulte a Regra #1.

5. **"O Lead está filtrado por deletedAt: null?"**
   → Se não, adicione.

---

## REGRA #15: FASES DE IMPLEMENTAÇÃO

A implementação segue esta ordem EXATA para minimizar risco:

```
FASE 0: Dependências (zero impacto)
  → npm install, criar libs sem dependências

FASE 1: Banco de dados (migration aditiva)
  → Schema CRM ao FINAL do schema.prisma, migrate

FASE 2: Backend (arquivos novos, zero impacto)
  → Queues, Evolution API, Audit, LGPD, RAG

FASE 3: Middleware (única alteração em arquivo existente)
  → Adicionar rotas públicas do webhook e SSE

FASE 4: Rotas + Páginas (arquivos novos)
  → Webhook, SSE, Layout CRM, Pipeline Kanban
  → Adicionar "CRM" à sidebar do admin

FASE 5: Workers (processo separado)
  → Workers BullMQ, seeds, Docker (Redis + Evolution)

FASE 6: Módulos incrementais
  → Caixa de Entrada, IA, Automações, RAG
```

---

## REGRA #16: COMPONENTES REUTILIZÁVEIS DO PROJETO

Antes de criar um componente novo, verifique se já existe:

| Componente | Caminho | Reutilizar no CRM? |
|---|---|---|
| `Skeleton*` (6 variantes) | `src/components/Skeleton.tsx` | Sim — criar variantes escuras |
| `Button` (3 variantes) | `src/components/Button.tsx` | Parcial — precisa variante escura |
| `Input / TextArea / Select` | `src/components/Input.tsx` | Parcial — precisa variante escura |
| `StatCard` | `src/components/dashboard/StatCard.tsx` | Inspiração — criar versão CRM |
| `useHaptic` (6 padrões) | `src/hooks/useHaptic.ts` | Sim — reutilizar diretamente |
| `useBodyScrollLock` | `src/hooks/useBodyScrollLock.ts` | Sim — painéis laterais |
| `useConfetti` | `src/hooks/useConfetti.ts` | Sim — celebração Lead GANHO |
| `useNotifications` | `src/hooks/useNotifications.ts` | Sim — alertas CRM |
| `InfoTooltip` | `src/components/InfoTooltip.tsx` | Sim |
| `UserAvatar` | `src/components/UserAvatar.tsx` | Sim — avatar nos leads |
| `AdminContext` | `app/admin/AdminContext.tsx` | Sim — `useAdmin()` para token |

---

## REGRA #17: CONTEXTO DE AUTENTICAÇÃO DO ADMIN

O admin usa Context API com localStorage:

```typescript
// app/admin/AdminContext.tsx
interface AdminUser { id: string; name: string; email: string; role: string; avatar?: string }
interface AdminContextType {
  user: AdminUser | null
  token: string | null
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>
  logout: () => void
}

// Usar em qualquer componente CRM:
import { useAdmin } from '@/app/admin/AdminContext'   // NÃO funciona em Componentes de Servidor
// Para Componentes de Servidor, ler token dos cookies ou cabeçalhos
```

---

## REGRA #18: REFERÊNCIA SSE (GPS)

O projeto já tem SSE funcionando em `/api/gps/stream/route.ts`. O padrão:

```typescript
// ReadableStream com TextEncoder
// Heartbeat a cada 30s (evitar timeout de proxy)
// Cleanup via req.signal.addEventListener('abort')
// Headers: text/event-stream, no-cache, X-Accel-Buffering: no
// Store separado para gerenciar sessões
```

O SSE do CRM seguirá EXATAMENTE este padrão, substituindo store em memória por Redis pub/sub.

---

## RESUMO RÁPIDO

| Pergunta | Resposta |
|---|---|
| Onde fica o CRM? | `app/admin/crm/` + `app/api/crm/` |
| Onde ficam os workers? | `workers/crm/` (processo separado) |
| Posso alterar User? | NÃO |
| Posso alterar Appointment? | NÃO |
| Posso alterar middleware.ts? | SIM, apenas ADICIONAR rotas públicas |
| Qual autenticação usar? | `verifyToken()` de `src/lib/auth.ts` |
| Qual cliente Prisma? | `prisma` de `src/lib/prisma.ts` |
| BullMQ Pro ou Gratuito? | GRATUITO (sem upsertJobScheduler) |
| Exclusão definitiva de Lead? | NUNCA (usar anonymizeLead) |
| Onde salvar credenciais? | Encriptadas via encryptCredentials() |
| Alias `@/` aponta para onde? | `src/` |
| Qual padrão de consulta no Kanban? | 2 consultas + reduce() em TypeScript |
| Qual fonte no CRM? | Cormorant Garamond (títulos) + DM Sans (interface) |
| Qual cor de acento no CRM? | `#D4AF37` (dourado) |
| Qual fundo do CRM? | `#0A0A0B` (ultra-escuro) |

---

*AI_RULES.md v2.0 (Português Completo) — Março 2026*
*18 regras cobrindo: isolamento, segurança, banco, TypeScript, design, entrega, fases*
