# ESCOPO FECHADO — Luna CRM SaaS Platform
> **Versão 1.0** — Março 2026
> **De:** Protótipo single-tenant (Clínica Mykaele)
> **Para:** Plataforma SaaS multi-tenant vendável em massa
>
> **Estado atual:** 47 models · 133+ APIs · 50+ páginas · 1 cliente ativo
> **Meta:** Infraestrutura para vender, demonstrar e gerenciar N clínicas

---

## ÍNDICE

1. [Diagnóstico do Protótipo](#1-diagnóstico-do-protótipo)
2. [Arquitetura SaaS Target](#2-arquitetura-saas-target)
3. [ENTREGA 1 — Multi-Tenancy Real](#3-entrega-1--multi-tenancy-real)
4. [ENTREGA 2 — Painel Admin Central (Luna HQ)](#4-entrega-2--painel-admin-central-luna-hq)
5. [ENTREGA 3 — Ambiente Demo](#5-entrega-3--ambiente-demo)
6. [ENTREGA 4 — Landing Page + Onboarding](#6-entrega-4--landing-page--onboarding)
7. [ENTREGA 5 — Billing e Planos](#7-entrega-5--billing-e-planos)
8. [ENTREGA 6 — Infra de Escala](#8-entrega-6--infra-de-escala)
9. [Schema Prisma — Novos Models](#9-schema-prisma--novos-models)
10. [Cronograma de Implementação](#10-cronograma-de-implementação)
11. [Decisões Pendentes](#11-decisões-pendentes)
12. [Estimativa de Custos Operacionais](#12-estimativa-de-custos-operacionais)
13. [Checklist Go-to-Market](#13-checklist-go-to-market)

---

## 1. DIAGNÓSTICO DO PROTÓTIPO

### O que JÁ EXISTE e funciona

| Camada | Status | Detalhes |
|--------|--------|---------|
| **Schema multi-tenant** | ✅ 90% pronto | Todos os 20 models CRM têm `tenantId` + indexes |
| **Pipeline Kanban** | ✅ Completo | Drag & drop, índice fracionário, cache de contadores |
| **Inbox WhatsApp** | ✅ Completo | Conversas bidirecionais via Evolution API |
| **IA Cascade** | ✅ Completo | 6 provedores com fallback automático (Gemini→Groq→OpenRouter→Together→OpenAI→Claude) |
| **RAG / Knowledge Base** | ✅ Completo | Upload PDF, embeddings pgvector, concierge |
| **Automações** | ✅ Completo | DAG visual com React Flow, 6 triggers |
| **Bot Visual** | ✅ Completo | Construtor drag & drop, sessões por lead |
| **Propostas** | ✅ Completo | Link público, tracking de visualização |
| **NPS** | ✅ Completo | Pesquisas automáticas pós-atendimento |
| **Equipe** | ✅ Completo | Roles (owner/admin/manager/agent), convites |
| **Relatórios** | ✅ 8 tipos | Overview, funil, atividades, ROI, metas, etc. |
| **LGPD** | ✅ Completo | Audit log, anonimização, criptografia AES-256-GCM |
| **Workers BullMQ** | ✅ Código pronto | 7 workers (precisa Redis em produção) |

### O que BLOQUEIA a venda em massa

| Gap | Impacto | Prioridade |
|-----|---------|-----------|
| **JWT sem tenantId** | Token: `{userId, email, role}` — sem tenant | CRÍTICO |
| **DEFAULT_TENANT_ID hardcoded** | ~30+ arquivos usam `process.env.DEFAULT_TENANT_ID` | CRÍTICO |
| **User sem tenantId** | Model User (legacy) não tem vínculo com tenant | CRÍTICO |
| **Sem painel master** | EB Develop não tem visão de todos os clientes | CRÍTICO |
| **Sem provisioning automático** | Criar novo cliente = manual no banco | ALTO |
| **Sem billing** | Sem cobrança recorrente | ALTO |
| **Sem demo** | Sem ambiente para demonstrar o produto | ALTO |
| **Sem landing page de vendas** | Sem funil de aquisição | ALTO |
| **Sem limites por plano** | Qualquer tenant usa tudo ilimitado | MÉDIO |
| **Sem onboarding guiado** | Cliente novo não sabe por onde começar | MÉDIO |
| **Evolution API compartilhada** | 1 instância = 1 número WhatsApp | MÉDIO |
| **Redis não configurado** | Workers/filas não rodam em produção | MÉDIO |

---

## 2. ARQUITETURA SAAS TARGET

### Visão Geral

```
┌─────────────────────────────────────────────────────────────────────┐
│                        LUNA PLATFORM                                 │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │  Luna HQ     │  │  Luna Demo   │  │  Luna Site   │               │
│  │  (Admin      │  │  (Ambiente   │  │  (Landing    │               │
│  │   Central)   │  │   showcase)  │  │   + vendas)  │               │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘               │
│         │                 │                  │                        │
│  ┌──────▼─────────────────▼──────────────────▼───────┐               │
│  │              MULTI-TENANT ENGINE                   │               │
│  │  JWT com tenantId · Middleware isolamento          │               │
│  │  Provisioning automático · Limites por plano       │               │
│  └──────┬─────────────────┬──────────────────┬───────┘               │
│         │                 │                  │                        │
│  ┌──────▼───┐  ┌──────────▼───┐  ┌──────────▼───────┐               │
│  │Tenant A  │  │  Tenant B    │  │  Tenant N        │               │
│  │(Mykaele) │  │  (Cliente 2) │  │  (Cliente N)     │               │
│  │Pipeline  │  │  Pipeline    │  │  Pipeline        │               │
│  │Inbox     │  │  Inbox       │  │  Inbox           │               │
│  │IA/RAG    │  │  IA/RAG      │  │  IA/RAG          │               │
│  └──────────┘  └──────────────┘  └──────────────────┘               │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────┐        │
│  │                    INFRAESTRUTURA                         │        │
│  │  PostgreSQL 16 (shared DB, tenantId isolation)            │        │
│  │  Redis 7 (filas, SSE pub/sub, presença — prefixo tenant) │        │
│  │  Evolution API (multi-instance por tenant)                │        │
│  │  BullMQ Workers (tenant-aware job routing)                │        │
│  │  Coolify / Docker Compose                                 │        │
│  └──────────────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────────┘
```

### Modelo de Acesso (3 níveis)

```
NÍVEL 1 — SUPER ADMIN (EB Develop)
├── Acessa: Luna HQ (painel central)
├── Pode: criar/suspender/deletar tenants
├── Pode: ver métricas de todos os tenants
├── Pode: impersonar qualquer tenant
├── Role no JWT: "SUPER_ADMIN"
└── URL: app.lunacrm.com.br/hq

NÍVEL 2 — ADMIN DO TENANT (Dono da clínica)
├── Acessa: CRM do seu tenant apenas
├── Pode: gerenciar equipe, pipelines, automações, IA
├── Pode: configurar WhatsApp, billing
├── Role no JWT: "ADMIN" + teamRole: "owner"
└── URL: app.lunacrm.com.br/admin/crm

NÍVEL 3 — MEMBRO DA EQUIPE (Recepcionista, vendedora)
├── Acessa: CRM do seu tenant apenas
├── Pode: ver leads atribuídos, responder conversas
├── NÃO pode: configurar, excluir, ver financeiro
├── Role no JWT: "ADMIN" + teamRole: "agent|manager"
└── URL: app.lunacrm.com.br/admin/crm
```

---

## 3. ENTREGA 1 — MULTI-TENANCY REAL

> **Prioridade:** CRÍTICA — é o alicerce de tudo.
> **Impacto no código existente:** MÉDIO (refactor de ~30 arquivos, zero mudança em models legacy)

### 3.1 — Mudanças no JWT

```
ATUAL:
  JWT payload = { userId, email, role }
  Roles: 'ADMIN' | 'PATIENT'

NOVO:
  JWT payload = { userId, email, role, tenantId?, teamRole?, isSuperAdmin? }
  Roles: 'ADMIN' | 'PATIENT' | 'SUPER_ADMIN'
  teamRole: 'owner' | 'admin' | 'manager' | 'agent' | null
```

**Arquivo:** `src/lib/auth.ts` — ÚNICA alteração no auth existente
- `generateToken()` recebe `tenantId` opcional
- `verifyToken()` retorna `tenantId` no payload
- Backward compatible: rotas legacy ignoram tenantId

### 3.2 — Middleware Tenant Resolution

```typescript
// Fluxo de resolução do tenant:
// 1. Login → usuário seleciona tenant (se pertence a mais de 1)
// 2. Token JWT gerado com tenantId
// 3. Middleware extrai tenantId do token em TODA request /api/crm/*
// 4. APIs leem tenantId do contexto (não mais de env var)

// NUNCA mudar URLs — resolve por token, não por path
// /admin/crm/* continua igual — tenant vem do JWT
```

### 3.3 — Tenant Context (novo)

```typescript
// src/lib/tenant-context.ts — NOVO ARQUIVO
// Helper para extrair tenantId de:
//   - JWT token (rotas API protegidas)
//   - Cookie (SSE sem Bearer)
//   - Query param (webhook com tenant identifier)

export function getTenantId(request: Request): string {
  // 1. Tenta extrair do JWT
  // 2. Fallback: cookie 'tenantId'
  // 3. Fallback: query param 'tenantId'
  // 4. Fallback: process.env.DEFAULT_TENANT_ID (retrocompatibilidade)
  // 5. Throw se nenhum encontrado
}
```

### 3.4 — Refactoring Obrigatório

**~30 arquivos precisam trocar:**
```
process.env.DEFAULT_TENANT_ID  →  getTenantId(request)
```

**Lista completa dos arquivos impactados:**

```
API Routes (extrair de request):
  app/api/crm/leads/route.ts
  app/api/crm/leads/[id]/route.ts
  app/api/crm/conversations/route.ts
  app/api/crm/conversations/[id]/route.ts
  app/api/crm/conversations/[id]/messages/route.ts
  app/api/crm/pipeline/route.ts
  app/api/crm/pipeline/stages/route.ts
  app/api/crm/stream/route.ts
  app/api/crm/knowledge/upload/route.ts
  app/api/crm/automations/route.ts
  app/api/crm/templates/route.ts
  app/api/crm/broadcasts/route.ts
  app/api/crm/tasks/route.ts
  app/api/crm/team/route.ts
  app/api/crm/reports/*/route.ts (8 rotas)
  app/api/crm/settings/route.ts
  app/api/crm/nps/route.ts
  app/api/crm/proposals/route.ts
  app/api/crm/sync-messages/route.ts
  app/api/webhooks/evolution/[...slug]/route.ts

Server Actions (extrair de cookie/session):
  actions/crm/move-lead.ts
  actions/crm/send-message.ts
  actions/crm/mark-clinical-media.ts

Pages (Server Components — extrair de cookie):
  app/admin/crm/pipeline/page.tsx
  app/admin/crm/inbox/page.tsx
  app/admin/crm/contacts/page.tsx
  app/admin/crm/intelligence/page.tsx
  app/admin/crm/automations/page.tsx
  app/admin/crm/reports/page.tsx
  app/admin/crm/settings/page.tsx

Libs (recebem tenantId como parâmetro — já fazem isso):
  src/lib/gemini.ts          ✅ já recebe tenantId
  src/lib/rag.ts             ✅ já recebe tenantId
  src/lib/audit.ts           ✅ já recebe tenantId
  src/lib/lgpd.ts            ✅ já recebe tenantId
  src/lib/evolution-api.ts   ⚠️ precisa instanceId por tenant

Stores (recebem tenantId do contexto):
  src/stores/crm-store.ts   ⚠️ precisa filtrar por tenant
  src/hooks/use-crm-stream.ts ⚠️ precisa canal SSE por tenant
```

### 3.5 — Login Multi-Tenant

```
FLUXO ATUAL:
  1. Login com email/senha
  2. Recebe JWT com {userId, email, role}
  3. Redireciona para /admin

FLUXO NOVO:
  1. Login com email/senha
  2. Backend verifica: usuário pertence a quantos tenants?
     a) 0 tenants CRM → redireciona para /admin (legacy, sem CRM)
     b) 1 tenant CRM → gera JWT com tenantId automaticamente → /admin/crm
     c) 2+ tenants → mostra tela de seleção de tenant → gera JWT → /admin/crm
  3. Switch de tenant disponível na sidebar (sem re-login)
```

### 3.6 — Isolamento de Dados

| Camada | Estratégia |
|--------|-----------|
| **PostgreSQL** | Shared DB, `tenantId` em todo WHERE (já existe nos models CRM) |
| **Redis** | Prefixo por tenant: `tenant:{id}:inbox`, `tenant:{id}:sse` |
| **Evolution API** | `instanceId` diferente por tenant (1 número WA = 1 instância) |
| **BullMQ** | `job.data.tenantId` em todo job, worker filtra/roteia |
| **Upload/Storage** | Subpasta por tenant no Cloudinary ou S3 |
| **SSE** | Canal Redis pub/sub por tenant: `crm:events:{tenantId}` |

### 3.7 — Backward Compatibility (Clínica Mykaele)

```
REGRA: A Mykaele NÃO pode parar de funcionar durante a migração.

Estratégia:
1. DEFAULT_TENANT_ID continua funcionando como fallback
2. getTenantId() retorna DEFAULT_TENANT_ID se JWT não tem tenantId
3. Login da Mykaele não muda (gera JWT com tenantId automaticamente)
4. Após migração, remover fallback e forçar tenantId em todo JWT

Ordem de execução:
  a) Deploy multi-tenant engine com fallback
  b) Verificar que Mykaele continua funcionando
  c) Testar criação de novo tenant
  d) Remover fallback quando estável
```

---

## 4. ENTREGA 2 — PAINEL ADMIN CENTRAL (Luna HQ)

> **Acesso:** Apenas SUPER_ADMIN (EB Develop)
> **URL:** `/admin/hq` ou domínio separado `hq.lunacrm.com.br`
> **Objetivo:** Visão 360° de todos os clientes SaaS

### 4.1 — Dashboard Master

```
┌─────────────────────────────────────────────────────────────────┐
│  🏢 Luna HQ                                         [EB Develop] │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ Clientes │ │   MRR    │ │  Leads   │ │  Msgs    │           │
│  │   12     │ │ R$4.800  │ │  1.847   │ │  23.4k   │           │
│  │ ativos   │ │ /mês     │ │ total    │ │ /mês     │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  CLIENTES                          [+ Novo Cliente]       │    │
│  ├──────────────────────────────────────────────────────────┤    │
│  │  Clínica          Plano    Leads  WA   IA    Status      │    │
│  │  ─────────────────────────────────────────────────────    │    │
│  │  Mykaele Procópio Pro      142    ✅   ✅   🟢 Ativo     │    │
│  │  Dra. Juliana     Starter  38     ✅   ❌   🟢 Ativo     │    │
│  │  Studio Beleza    Pro      91     ✅   ✅   🟡 Trial     │    │
│  │  [Demo]           -        50     🔵   ✅   🔵 Demo      │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────┐  ┌─────────────────────────────┐   │
│  │  ALERTAS                │  │  RECEITA (últimos 6 meses)  │   │
│  │  ⚠️ Studio: WA offline │  │  ████████████████████        │   │
│  │  ⚠️ Dra.J: DLQ 3 jobs  │  │  ████████████████████████    │   │
│  │  ✅ Mykaele: tudo OK    │  │  R$ 2.4k → R$ 4.8k (+100%) │   │
│  └─────────────────────────┘  └─────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 — Funcionalidades do HQ

| Feature | Descrição |
|---------|-----------|
| **Lista de Clientes** | Tabela com filtros: nome, plano, status, data criação |
| **Criar Cliente** | Wizard: nome → slug → plano → owner (email) → provisioning automático |
| **Health Monitor** | Por tenant: Evolution API status, DLQ size, último webhook, erros |
| **Impersonar** | Botão "Entrar como" → abre CRM do tenant em nova aba |
| **Suspender/Reativar** | Pausa acesso do tenant (inadimplência) |
| **Métricas por Tenant** | Leads criados, mensagens enviadas, chamadas IA, storage usado |
| **Billing Dashboard** | Planos ativos, próximos vencimentos, inadimplentes |
| **Alertas Automáticos** | Email para EB Develop quando: WA desconecta, DLQ acumula, trial vence |
| **Logs de Sistema** | Aggregated: erros 500, latência média, jobs processados |
| **Configuração Global** | Provedores IA default, limites por plano, templates de email |

### 4.3 — Provisioning Automático (Criar Novo Cliente)

Ao clicar "Novo Cliente" no HQ, o sistema executa automaticamente:

```
PASSO 1 — Validação
  ├── Slug único (ex: "dra-juliana-clinica")
  ├── Email do owner não existe em outro tenant como owner
  └── Plano selecionado válido

PASSO 2 — Database (1 transaction)
  ├── Criar CrmTenant { name, slug }
  ├── Criar Pipeline padrão com 6 estágios:
  │     Novo Lead → Qualificação → Proposta → Negociação → Ganho → Perdido
  ├── Criar CrmAiConfig com defaults (Gemini free)
  ├── Criar CrmChannel vazio (WhatsApp a conectar depois)
  ├── Criar CrmNotificationSetting defaults
  ├── Criar Subscription { tenantId, planId, status: 'TRIAL', trialEndsAt: +14d }
  └── Criar CrmTeamMember { tenantId, userId, role: 'owner' }

PASSO 3 — User
  ├── Se email já existe na tabela User → vincular como owner
  ├── Se email NÃO existe → criar User + enviar email com senha temporária
  └── Gerar JWT com tenantId para primeiro acesso

PASSO 4 — Comunicação
  ├── Email de boas-vindas com:
  │     - Link de acesso
  │     - Credenciais (se usuário novo)
  │     - Guia de primeiros passos
  │     - Link para conectar WhatsApp
  └── Notificação no HQ: "Novo cliente criado: {nome}"

PASSO 5 — Post-provisioning
  ├── Criar 3 leads de exemplo (para o tour guiado funcionar)
  ├── Criar 1 template de mensagem de boas-vindas
  └── Criar 1 automação exemplo (desativada)
```

### 4.4 — Estrutura de Arquivos (Luna HQ)

```
app/admin/hq/                        # Novo — Painel Central
  ├── layout.tsx                     # Layout HQ (sidebar diferente do CRM)
  ├── page.tsx                       # Dashboard com KPIs globais
  ├── clients/
  │   ├── page.tsx                   # Lista de clientes/tenants
  │   ├── [tenantId]/
  │   │   ├── page.tsx               # Detalhe do tenant (health, métricas)
  │   │   └── impersonate/route.ts   # Gera JWT temporário para impersonar
  │   └── new/
  │       └── page.tsx               # Wizard de criação
  ├── billing/
  │   ├── page.tsx                   # Dashboard financeiro
  │   └── plans/page.tsx             # Gerenciar planos
  ├── alerts/page.tsx                # Alertas de sistema
  ├── logs/page.tsx                  # Logs aggregados
  └── settings/page.tsx              # Configurações globais

app/api/hq/                          # APIs do HQ
  ├── tenants/route.ts               # CRUD de tenants
  ├── tenants/[id]/route.ts          # Detalhes do tenant
  ├── tenants/[id]/suspend/route.ts  # Suspender tenant
  ├── tenants/[id]/metrics/route.ts  # Métricas do tenant
  ├── provision/route.ts             # Provisioning automático
  ├── billing/route.ts               # Dados de billing
  └── alerts/route.ts                # Alertas de sistema
```

---

## 5. ENTREGA 3 — AMBIENTE DEMO

> **Objetivo:** Ambiente funcional para prospects testarem o Luna CRM
> **Acesso:** Link público ou login com credenciais demo
> **Reset:** Dados resetam automaticamente a cada 24h

### 5.1 — Dados de Demonstração

```
TENANT DEMO: "demo-luna"

PIPELINE "Vendas" com 6 estágios:
  ├── Novo Lead (8 leads)
  ├── Qualificação (6 leads)
  ├── Proposta Enviada (4 leads)
  ├── Negociação (3 leads)
  ├── ✅ Ganho (5 leads)
  └── ❌ Perdido (2 leads)

28 LEADS fictícios com:
  ├── Nomes brasileiros realistas
  ├── Telefones válidos (formato, não reais)
  ├── Tags de procedimento (Botox, Harmonização, Skinbooster, etc.)
  ├── Valores esperados (R$ 800 — R$ 12.000)
  ├── AI Score distribuído (20-95)
  ├── Janela de Ouro calculada
  ├── Fonte variada (Instagram, Indicação, Google, WhatsApp)
  └── Datas espalhadas nos últimos 30 dias

10 CONVERSAS simuladas com:
  ├── 15-40 mensagens cada (alternando fromMe true/false)
  ├── Conteúdo realista:
  │     "Oi, vi o perfil de vocês no Instagram, quanto custa harmonização?"
  │     "O procedimento dói muito? Tenho medo de agulha"
  │     "Vocês parcelam em quantas vezes?"
  │     "Posso agendar para semana que vem?"
  ├── Tipos variados: texto, imagem (foto de referência), áudio
  ├── Sentimento IA calculado
  └── Resumo IA gerado

3 DOCUMENTOS na Base de Conhecimento:
  ├── "Protocolo de Harmonização Facial — Ácido Hialurônico"
  ├── "FAQ — Perguntas Frequentes dos Pacientes"
  └── "Cuidados Pós-Procedimento — Guia Completo"

2 AUTOMAÇÕES exemplo (ativas na demo):
  ├── "Auto-resposta para novos leads" (trigger: NEW_MESSAGE_RECEIVED)
  └── "Mover para Qualificação após 2 mensagens" (trigger: LEAD_STAGE_CHANGED)

1 BOT FLOW exemplo:
  └── "Triagem Inicial" (5 nós: saudação → pergunta procedimento → pergunta data → agendamento → confirmação)

5 TEMPLATES:
  ├── "Boas-vindas"
  ├── "Agendamento confirmado"
  ├── "Lembrete 24h"
  ├── "Pós-procedimento"
  └── "Reativação"

MÉTRICAS pre-calculadas (últimos 30 dias):
  ├── Taxa de conversão: 17.8%
  ├── Tempo médio de resposta: 4 min
  ├── Leads novos/semana: 12
  ├── Receita total: R$ 47.200
  ├── NPS Score: 72
  └── Fonte mais eficiente: Instagram (32% conversão)
```

### 5.2 — Simulador WhatsApp (sem Evolution API)

```
PROBLEMA: A demo não pode depender de Evolution API real
  (sem número WhatsApp, sem servidor externo)

SOLUÇÃO: Simulador interno que:
  1. Exibe conversas pré-carregadas do seed
  2. Permite "enviar mensagem" → salva no banco normalmente
  3. Gera "resposta automática" da paciente fake após 3-8 segundos
  4. Respostas variam conforme contexto (IA ou template predefinido)
  5. SSE funciona normalmente (badge de nova mensagem)
  6. Indicador visual: "🔵 Modo Demo — conversas simuladas"

IMPLEMENTAÇÃO:
  src/lib/demo-simulator.ts
  - simulatePatientReply(conversationId, lastMessage) → Message
  - Banco de respostas por contexto (preço, agendamento, dúvida, objeção)
  - Delay aleatório 3-8s para parecer real
```

### 5.3 — Tour Guiado (Onboarding da Demo)

```
FLUXO DO TOUR (react-joyride ou custom):

Passo 1: "Bem-vindo ao Luna CRM 👋"
  → Overlay com logo Luna + "Este é o CRM que suas pacientes merecem"
  → Botão: "Começar tour" / "Explorar sozinho"

Passo 2: Pipeline (highlight na coluna "Novo Lead")
  → "Cada card é uma paciente interessada nos seus procedimentos"
  → "Arraste para avançar no funil" → destaca drag & drop
  → Convida a arrastar um card

Passo 3: Lead Card (highlight em 1 card)
  → "Score de IA, Janela de Ouro e valor — tudo em um olhar"
  → "Clique para ver detalhes completos"

Passo 4: Inbox (redireciona para /admin/crm/inbox)
  → "Todas as conversas WhatsApp em um só lugar"
  → "A Luna sugere respostas baseadas nos seus protocolos"
  → Abre uma conversa e mostra o Concierge RAG

Passo 5: Inteligência (redireciona para /admin/crm/intelligence)
  → "Janela de Ouro: saiba QUANDO ligar para converter mais"
  → "Radar de Retenção: saiba QUEM vai sumir"

Passo 6: Automações (redireciona para /admin/crm/automations)
  → "Crie bots visuais sem código"
  → Mostra o React Flow com um fluxo funcionando

Passo 7: Relatórios (redireciona para /admin/crm/reports)
  → "Saiba exatamente de onde vem cada Real"
  → Mostra dashboard com ROI por fonte

Passo 8: CTA Final
  → "Pronto para revolucionar sua clínica?"
  → [Agendar demo ao vivo] [Começar trial grátis]
  → Redireciona para landing page com UTM
```

### 5.4 — Reset Automático

```
CRON DIÁRIO (ou a cada 12h):
  1. Deletar todos os dados do tenant "demo-luna" (cascade)
  2. Re-executar seed completo
  3. Logar: "Demo resetada em {timestamp}"

PROTEÇÃO:
  - Tenant demo NÃO pode ser deletado pelo HQ
  - Tenant demo NÃO pode conectar Evolution API real
  - Tenant demo NÃO pode enviar emails reais
  - Tenant demo NÃO pode criar mais que 100 leads
```

### 5.5 — Acesso à Demo

```
OPÇÃO A — Acesso Direto (sem cadastro):
  URL: demo.lunacrm.com.br
  Login: demo@lunacrm.com.br / demo2026
  Redireciona direto para /admin/crm/pipeline
  Tour guiado inicia automaticamente

OPÇÃO B — Acesso via Landing Page:
  CTA "Teste grátis" → form com nome + email + clínica
  Salva lead no HQ → redireciona para demo com tour
  Após tour → CTA para trial real (14 dias)
```

---

## 6. ENTREGA 4 — LANDING PAGE + ONBOARDING

### 6.1 — Landing Page de Vendas

```
URL: lunacrm.com.br (ou luna.ebdevelop.com.br)

ESTRUTURA:

HERO
  ├── Headline: "Pare de perder pacientes no WhatsApp"
  ├── Subheadline: "Luna é o CRM que entende clínicas de estética"
  ├── CTA primário: [Teste grátis por 14 dias]
  ├── CTA secundário: [Ver demo ao vivo]
  └── Visual: mockup animado do Pipeline + Inbox

PROBLEMA
  ├── "80% das clínicas perdem leads por responder tarde"
  ├── "Planilhas não avisam quando a paciente vai sumir"
  ├── "Bots genéricos espantam pacientes de R$4.000"
  └── Animação: mensagem WhatsApp sem resposta → lead perdido

SOLUÇÃO (6 features)
  ├── 🎯 Pipeline Visual — arraste, organize, converta
  ├── 💬 Inbox Unificado — todas as conversas em 1 tela
  ├── 🧠 IA Especialista — sugestões baseadas nos SEUS protocolos
  ├── ⏰ Janela de Ouro — saiba QUANDO ligar (exclusivo Luna)
  ├── 🔄 Automações — respostas e follow-ups no piloto automático
  └── 📊 Relatórios — ROI real de cada fonte de paciente

COMPARATIVO
  ┌───────────────────┬──────┬──────┬───────────┐
  │ Feature           │ Luna │Kommo │ Planilha  │
  ├───────────────────┼──────┼──────┼───────────┤
  │ Pipeline visual   │  ✅  │  ✅  │    ❌     │
  │ WhatsApp nativo   │  ✅  │  💰  │    ❌     │
  │ IA especializada  │  ✅  │  ❌  │    ❌     │
  │ Janela de Ouro    │  ✅  │  ❌  │    ❌     │
  │ RAG (protocolos)  │  ✅  │  ❌  │    ❌     │
  │ Radar retenção    │  ✅  │  ❌  │    ❌     │
  │ Propostas c/ link │  ✅  │  ✅  │    ❌     │
  │ Bot visual        │  ✅  │  💰  │    ❌     │
  │ Preço/mês         │ R$197│R$499+│   R$0     │
  │ Em português      │  ✅  │  ❌  │    ✅     │
  └───────────────────┴──────┴──────┴───────────┘

PROVA SOCIAL
  ├── Case Clínica Mykaele: "Aumentamos conversão em 40% no primeiro mês"
  ├── Métricas reais: 142 leads geridos, 17.8% conversão, NPS 72
  ├── Screenshot do pipeline real (dados sensíveis borrados)
  └── Depoimento em vídeo (se disponível)

PREÇOS
  ├── Starter: R$ 97/mês (1 pipeline, 500 leads, 1 WA)
  ├── Pro: R$ 197/mês (3 pipelines, 5k leads, 2 WA, IA)
  ├── Enterprise: R$ 497/mês (ilimitado, white-label, API)
  └── Todos com 14 dias grátis, sem cartão

FAQ
  ├── "Preciso de número de WhatsApp separado?" → Sim, número dedicado
  ├── "Funciona com Instagram?" → Em breve (roadmap Q2)
  ├── "Meus dados são seguros?" → LGPD compliant, criptografia AES-256
  ├── "Posso importar leads?" → Sim, importação em massa CSV
  └── "Quanto tempo para configurar?" → 15 minutos com suporte

FOOTER
  ├── Links: Termos, Privacidade, LGPD, Status da plataforma
  ├── Contato: WhatsApp da EB Develop
  └── "Feito no Brasil 🇧🇷 por EB Develop"
```

### 6.2 — Onboarding Wizard (Novo Cliente)

```
APÓS SIGNUP (trial ou pago):

PASSO 1 — "Vamos configurar sua clínica" (30s)
  ├── Nome da clínica
  ├── Especialidade (estética, dermatologia, odontologia)
  ├── Quantidade de atendimentos/mês
  └── Quantas pessoas vão usar o sistema

PASSO 2 — "Conecte seu WhatsApp" (2-5 min)
  ├── QR Code da Evolution API
  ├── Instrução passo a passo com screenshots
  ├── Verificação automática de conexão
  └── Opção: "Configurar depois" (pula para passo 3)

PASSO 3 — "Personalize seu pipeline" (1 min)
  ├── Pipeline padrão já criado (pode renomear estágios)
  ├── Sugestão: "A maioria das clínicas usa estes 5 estágios"
  └── Botão: "Usar padrão" (skip)

PASSO 4 — "Importe seus contatos" (opcional)
  ├── Upload CSV com nome + telefone
  ├── Ou: "Preencher manualmente depois"
  └── Máximo 500 leads no trial

PASSO 5 — "Treine sua IA" (opcional)
  ├── Upload PDF dos protocolos da clínica
  ├── Ou: "Usar base genérica de estética"
  └── IA já funciona com base genérica

PASSO 6 — "Tudo pronto! 🎉"
  ├── Checklist visual: ✅ Clínica criada ✅ Pipeline pronto ✅ IA ativada
  ├── [Abrir meu CRM] → redireciona para /admin/crm/pipeline
  └── "Dica: seu primeiro lead já está esperando" (lead de exemplo criado)
```

---

## 7. ENTREGA 5 — BILLING E PLANOS

### 7.1 — Planos

| Plano | Preço/mês | Pipelines | Leads | WhatsApp | IA | Usuários | Automações | RAG | White-label |
|-------|----------|-----------|-------|----------|----|---------|-----------|----|------------|
| **Trial** | R$ 0 (14 dias) | 1 | 100 | 1 | Básica | 1 | 2 | 1 doc | ❌ |
| **Starter** | R$ 97 | 1 | 500 | 1 | Score | 2 | 5 | 3 docs | ❌ |
| **Pro** | R$ 197 | 3 | 5.000 | 2 | Completa | 5 | Ilimitado | 20 docs | ❌ |
| **Enterprise** | R$ 497 | Ilimitado | Ilimitado | 5 | Completa + RAG avançado | Ilimitado | Ilimitado | Ilimitado | ✅ |

### 7.2 — Limites e Enforcement

```typescript
// src/lib/plan-limits.ts — NOVO

interface PlanLimits {
  maxPipelines: number        // Criar pipeline bloqueia se atingiu
  maxLeads: number            // Criar lead bloqueia se atingiu
  maxChannels: number         // Conectar WA bloqueia se atingiu
  maxTeamMembers: number      // Convidar membro bloqueia se atingiu
  maxAutomations: number      // Criar automação bloqueia se atingiu
  maxKnowledgeDocs: number    // Upload RAG bloqueia se atingiu
  hasAiScore: boolean         // Score de IA habilitado?
  hasGoldenWindow: boolean    // Janela de Ouro habilitada?
  hasRetentionRadar: boolean  // Radar de Retenção habilitado?
  hasConcierge: boolean       // Concierge RAG habilitado?
  hasBotBuilder: boolean      // Bot visual habilitado?
  hasAdvancedReports: boolean // Relatórios avançados habilitados?
  hasWhiteLabel: boolean      // White-label habilitado?
  hasApiAccess: boolean       // API externa habilitada?
}

// Middleware verifica antes de cada ação:
// checkPlanLimit(tenantId, 'leads') → true/false
// Se false → retorna 403 + mensagem: "Limite do plano atingido. Faça upgrade."
```

### 7.3 — Billing Provider

```
OPÇÃO RECOMENDADA: Asaas (brasileiro)

Motivos:
  ├── PIX gratuito (0% taxa)
  ├── Boleto R$ 1,99/boleto
  ├── Cartão de crédito 2,99%
  ├── Recorrência nativa (cobrar todo mês automaticamente)
  ├── Webhook de pagamento/inadimplência
  ├── API REST simples
  ├── Split de pagamento (se precisar no futuro)
  └── Dashboard financeiro incluso

ALTERNATIVA: Stripe
  ├── Internacional
  ├── 3.99% + R$ 0,39 por transação
  ├── Melhor para planos Enterprise com clientes fora do BR
  └── Mais complexo de integrar para boleto/PIX
```

### 7.4 — Fluxo de Cobrança

```
TRIAL (14 dias):
  Dia 0  → Tenant criado com status TRIAL
  Dia 10 → Email: "Seu trial expira em 4 dias"
  Dia 13 → Email: "Último dia de trial!"
  Dia 14 → Tenant suspendido (read-only, sem enviar msg, banner de upgrade)
  Dia 21 → Email final: "Sentimos sua falta — 20% desconto no primeiro mês"
  Dia 30 → Dados do trial são anonimizados (LGPD)

PAGAMENTO:
  Assinatura via Asaas → webhook confirma pagamento
  → Subscription.status = 'ACTIVE'
  → Tenant liberado com limites do plano

INADIMPLÊNCIA:
  Dia 0   → Pagamento falhou → email "Problema com pagamento"
  Dia 3   → Retry automático (Asaas faz isso)
  Dia 7   → Tenant suspendido (read-only + banner)
  Dia 15  → Notificação no HQ para EB Develop
  Dia 30  → Dados exportados (CSV) → tenant desativado
  Dia 90  → Dados anonimizados (LGPD)

UPGRADE/DOWNGRADE:
  ├── Upgrade: imediato, cobrado proporcional
  ├── Downgrade: efetivo no próximo ciclo
  └── Se downgrade viola limites: aviso "Reduza X antes de confirmar"
```

---

## 8. ENTREGA 6 — INFRA DE ESCALA

### 8.1 — Matriz de Infraestrutura por Escala

```
FASE 1: 1-10 CLIENTES (atual)
  ├── 1 VPS (Coolify) ~R$ 100-200/mês
  ├── 1 PostgreSQL (local)
  ├── 1 Redis (local)
  ├── 1 Evolution API (local)
  ├── 1 Worker BullMQ (local)
  ├── Total: ~R$ 200/mês
  └── Margem: R$ 97 × 10 = R$ 970 receita - R$ 200 custo = R$ 770/mês

FASE 2: 10-50 CLIENTES
  ├── 2 VPS (Coolify) — app + worker separados
  ├── PostgreSQL managed (Neon free tier ou Supabase)
  ├── Redis managed (Upstash free tier até 10k cmd/dia)
  ├── Evolution API VPS dedicada
  ├── Total: ~R$ 400-800/mês
  └── Margem: R$ 197 × 30 = R$ 5.910 receita - R$ 600 custo = R$ 5.310/mês

FASE 3: 50-200 CLIENTES
  ├── Kubernetes ou Docker Swarm (3 nós)
  ├── PostgreSQL managed (Neon Pro ou AWS RDS)
  ├── Redis managed (Upstash Pro ou ElastiCache)
  ├── Evolution API cluster (load balanced)
  ├── Workers auto-scaled
  ├── CDN para assets (Cloudflare)
  ├── Total: ~R$ 2.000-4.000/mês
  └── Margem: R$ 197 × 100 = R$ 19.700 receita - R$ 3.000 custo = R$ 16.700/mês
```

### 8.2 — Evolution API Multi-Tenant

```
MODELO ATUAL: 1 instância = 1 número WhatsApp = 1 clínica

MODELO MULTI-TENANT:
  ├── Evolution API suporta múltiplas instances por instalação
  ├── Cada tenant cria sua própria instance (nome = slug do tenant)
  ├── Cada instance conecta 1 número WhatsApp via QR Code
  ├── Webhook route já é catch-all: /api/webhooks/evolution/[...slug]
  └── Webhook data inclui instanceId → resolve tenantId

PROVISIONING:
  1. Tenant ativa WhatsApp na página /admin/crm/settings
  2. API chama Evolution: POST /instance/create { instanceName: tenant.slug }
  3. Evolution retorna QR Code → exibido na UI
  4. Usuário escaneia → instance conecta → webhook confirma
  5. CrmChannel criado com instanceId = tenant.slug

LIMITES:
  - Starter: 1 instance (1 número)
  - Pro: 2 instances (2 números)
  - Enterprise: 5 instances (5 números)
  - Cada instance consome ~50-100MB RAM
  - VPS de 4GB suporta ~30-40 instances simultâneas
```

### 8.3 — Backup e Disaster Recovery

```
POSTGRESQL:
  ├── Backup diário automático (pg_dump comprimido)
  ├── Retenção: 30 dias
  ├── Point-in-time recovery via WAL (se managed)
  └── Teste de restore mensal

REDIS:
  ├── Dados são efêmeros (filas, cache, presença)
  ├── RDB snapshot diário (backup do estado)
  └── Se perder Redis → filas reiniciam, sem perda de dados permanentes

EVOLUTION API:
  ├── Sessions são efêmeras (precisa re-conectar WhatsApp se perder)
  ├── Mensagens estão no PostgreSQL (não no Evolution)
  └── Backup das credenciais de instance no CrmIntegration

COOLIFY:
  ├── Docker volumes mapeados para host
  ├── Backup do /data/coolify periódico
  └── Export da config de deployment
```

---

## 9. SCHEMA PRISMA — NOVOS MODELS

> **ADICIONAR AO FINAL** do `prisma/schema.prisma`.
> NÃO alterar nada existente.

```prisma
// ============================================================
// MÓDULO SAAS PLATFORM — v1.0
// Adicionar ao FINAL do schema.prisma.
// NÃO alterar NADA acima desta linha.
// ============================================================

enum SubscriptionStatus {
  TRIAL ACTIVE PAST_DUE SUSPENDED CANCELLED
}

model SubscriptionPlan {
  id              String   @id @default(cuid())
  name            String   @unique            // "starter", "pro", "enterprise"
  displayName     String                      // "Starter", "Pro", "Enterprise"
  priceMonthly    Float                       // 97.00, 197.00, 497.00
  priceYearly     Float?                      // desconto anual

  // Limites
  maxPipelines       Int   @default(1)
  maxLeads           Int   @default(500)
  maxChannels        Int   @default(1)
  maxTeamMembers     Int   @default(2)
  maxAutomations     Int   @default(5)
  maxKnowledgeDocs   Int   @default(3)
  maxBotFlows        Int   @default(1)

  // Features
  hasAiScore          Boolean @default(false)
  hasGoldenWindow     Boolean @default(false)
  hasRetentionRadar   Boolean @default(false)
  hasConcierge        Boolean @default(false)
  hasBotBuilder       Boolean @default(false)
  hasAdvancedReports  Boolean @default(false)
  hasWhiteLabel       Boolean @default(false)
  hasApiAccess        Boolean @default(false)
  hasBroadcast        Boolean @default(false)
  hasNps              Boolean @default(false)
  hasProposals        Boolean @default(false)

  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  subscriptions Subscription[]
}

model Subscription {
  id          String             @id @default(cuid())
  tenantId    String             @unique
  planId      String
  status      SubscriptionStatus @default(TRIAL)

  // Datas
  trialEndsAt   DateTime?
  currentPeriodStart DateTime?
  currentPeriodEnd   DateTime?
  cancelledAt        DateTime?
  suspendedAt        DateTime?

  // Billing
  billingProvider   String?         // "asaas" | "stripe" | "manual"
  externalId        String?         // ID no provedor de billing
  externalCustomerId String?        // ID do customer no provedor

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  plan   SubscriptionPlan @relation(fields: [planId], references: [id])

  @@index([tenantId])
  @@index([status])
  @@index([planId])
}

model UsageMetric {
  id        String   @id @default(cuid())
  tenantId  String
  metric    String   // "leads_created", "messages_sent", "ai_calls", "storage_mb"
  value     Float
  period    String   // "2026-03" (ano-mês)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([tenantId, metric, period])
  @@index([tenantId, period])
}

model BillingEvent {
  id         String   @id @default(cuid())
  tenantId   String
  type       String   // "payment_confirmed", "payment_failed", "plan_changed", "trial_started"
  amount     Float?
  currency   String   @default("BRL")
  externalId String?  // ID no provedor
  metadata   Json?
  createdAt  DateTime @default(now())

  @@index([tenantId, createdAt(sort: Desc)])
  @@index([type])
}

model SupportTicket {
  id        String   @id @default(cuid())
  tenantId  String
  userId    String
  subject   String
  body      String   @db.Text
  status    String   @default("open") // "open", "in_progress", "resolved", "closed"
  priority  String   @default("normal") // "low", "normal", "high", "urgent"
  resolvedAt DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([tenantId, status])
  @@index([status, priority])
}

model DemoSession {
  id         String   @id @default(cuid())
  visitorEmail String?
  visitorName  String?
  visitorClinic String?
  startedAt  DateTime @default(now())
  tourStep   Int      @default(0)  // Último passo do tour completado
  convertedToTrial Boolean @default(false)
  utmSource  String?
  utmMedium  String?
  utmCampaign String?

  @@index([convertedToTrial])
  @@index([startedAt])
}
```

---

## 10. CRONOGRAMA DE IMPLEMENTAÇÃO

### Visão Geral

```
SEMANA 1-2  ████████████████░░░░  Multi-Tenancy Core        CRÍTICO
SEMANA 3    ████████░░░░░░░░░░░░  Admin Central (HQ)        CRÍTICO
SEMANA 4    ████████░░░░░░░░░░░░  Demo Environment          ALTO
SEMANA 5    ████████░░░░░░░░░░░░  Landing + Onboarding      ALTO
SEMANA 6    ████████░░░░░░░░░░░░  Billing (Asaas)           ALTO
SEMANA 7    ████████░░░░░░░░░░░░  Polish + Testes           MÉDIO
SEMANA 8    ████████░░░░░░░░░░░░  Beta (3-5 clínicas)       GO LIVE
```

### Detalhamento por Semana

**SEMANA 1 — Multi-Tenancy Foundation**
```
□ Criar src/lib/tenant-context.ts (getTenantId helper)
□ Alterar src/lib/auth.ts (tenantId no JWT — backward compatible)
□ Criar middleware de tenant isolation
□ Refatorar 15 API routes (primeira metade) para usar getTenantId()
□ Testes: Mykaele continua funcionando com fallback
```

**SEMANA 2 — Multi-Tenancy Complete**
```
□ Refatorar 15 API routes restantes
□ Refatorar Server Actions (3 arquivos)
□ Refatorar Server Components (9 páginas CRM)
□ Refatorar stores e hooks
□ Login multi-tenant (seletor de tenant)
□ Cookie de tenant para SSE
□ Redis prefixo por tenant
□ Testes end-to-end: criar tenant B, verificar isolamento
```

**SEMANA 3 — Admin Central (Luna HQ)**
```
□ Schema: SubscriptionPlan, Subscription, UsageMetric, BillingEvent
□ Prisma migrate
□ Seed: 3 planos (Starter, Pro, Enterprise)
□ Layout HQ (app/admin/hq/layout.tsx)
□ Dashboard Master (KPIs globais)
□ Lista de tenants com status
□ Wizard "Novo Cliente" (provisioning automático)
□ Impersonar tenant
□ API: /api/hq/tenants, /api/hq/provision
```

**SEMANA 4 — Demo Environment**
```
□ Seed completo do tenant demo (28 leads, 10 conversas, 3 docs RAG)
□ Simulador WhatsApp (demo-simulator.ts)
□ Tour guiado (8 passos com highlights)
□ Reset automático (cron 24h)
□ Proteções do modo demo (sem enviar real, sem Evolution API)
□ Login demo com credenciais fixas
```

**SEMANA 5 — Landing Page + Onboarding**
```
□ Landing page em /landing ou domínio separado
□ 7 seções: Hero, Problema, Solução, Comparativo, Social Proof, Preços, FAQ
□ Form de trial (nome + email + clínica → cria tenant + redireciona)
□ Onboarding wizard (5 passos pós-signup)
□ Emails transacionais: boas-vindas, trial expirando, trial expirado
```

**SEMANA 6 — Billing**
```
□ Integração Asaas (criar customer, criar subscription, webhook)
□ Plan limits middleware (checkPlanLimit)
□ UI de upgrade/downgrade
□ Lógica de suspensão por inadimplência
□ Dashboard billing no HQ
□ Emails de cobrança (falha, retry, suspensão)
```

**SEMANA 7 — Polish + Testes**
```
□ Testar fluxo completo: signup → trial → uso → pagamento → renovação
□ Testar isolamento: tenant A não vê dados de tenant B
□ Testar limites: ultrapassar limite do plano → mensagem de upgrade
□ Testar demo: tour funciona, reset funciona, simulador funciona
□ Testar billing: Asaas webhook → subscription ativa
□ Performance: 10 tenants simultâneos na mesma VPS
□ Segurança: tentativa de acessar outro tenant → 403
```

**SEMANA 8 — Beta Launch**
```
□ Configurar domínio app.lunacrm.com.br
□ Deploy da plataforma em Coolify
□ Configurar Evolution API para multi-instance
□ Setup Redis em produção
□ Convidar 3-5 clínicas piloto (gratuito por 30 dias)
□ Monitorar HQ diariamente
□ Coletar feedback para iteração
```

---

## 11. DECISÕES (DEFINIDAS)

| # | Decisão | Definição | Status |
|---|---------|----------|--------|
| 1 | **Produto** | Site + CRM juntos (não só CRM) | ✅ DEFINIDO |
| 2 | **Domínio** | `lunacrm.com.br` (plataforma) + domínio próprio no Enterprise | ✅ DEFINIDO |
| 3 | **Deploy** | Coolify, VPS única grande (escala vertical) | ✅ DEFINIDO |
| 4 | **White-label** | Sim, plano Enterprise (logo, cores, domínio) | ✅ DEFINIDO |
| 5 | **Evolution API** | Multi-instance compartilhada (agora), Meta API (futuro) | ✅ DEFINIDO |
| 6 | **Billing** | Asaas (PIX grátis, boleto barato, recorrência automática) | ✅ DEFINIDO |
| 7 | **Infra** | 1 VPS 16GB para até 20 clientes, escalar conforme cresce | ✅ DEFINIDO |
| 8 | **Preços** | R$ 197 / R$ 397 / R$ 797 (Site + CRM) | ✅ DEFINIDO |
| 9 | **Killer Feature** | Radar de Retenção Biológico (ciclos de procedimento) | ✅ DEFINIDO |
| 10 | **Trial** | 14 dias grátis | ✅ DEFINIDO |

**Decisões pendentes:**

| # | Decisão | Precisa definir |
|---|---------|----------------|
| 1 | Nome do domínio exato | Registrar `lunacrm.com.br` ? |
| 2 | Conta Asaas | Abrir conta PJ da EB Develop |
| 3 | VPS | Hetzner, Contabo ou outra? Qual plano? |
| 4 | Suporte | WhatsApp dedicado ou mesmo número EB Develop? |

---

## 12. ESTIMATIVA DE CUSTOS OPERACIONAIS

### Custo Fixo (1-20 clientes)

| Item | Custo/mês | Nota |
|------|----------|------|
| VPS Coolify (8GB RAM) | R$ 150 | Hetzner ou Contabo |
| Domínio lunacrm.com.br | R$ 3 | Registro.br |
| Resend (emails) | R$ 0 | Free tier: 3.000/mês |
| IA (Gemini + Groq free) | R$ 0 | ~16.000 req/dia grátis |
| Asaas (billing) | R$ 0 | Sem mensalidade |
| Cloudflare (DNS/CDN) | R$ 0 | Free tier |
| **Total** | **~R$ 153** | |

### Receita Projetada

| Clientes | Mix de planos | Receita bruta | Custo infra | Lucro |
|----------|--------------|---------------|-------------|-------|
| 5 | 3 Starter + 2 Pro | R$ 685 | R$ 200 | R$ 485 |
| 10 | 5 Starter + 4 Pro + 1 Ent | R$ 1.770 | R$ 300 | R$ 1.470 |
| 20 | 8 Starter + 10 Pro + 2 Ent | R$ 3.740 | R$ 500 | R$ 3.240 |
| 50 | 15 Starter + 28 Pro + 7 Ent | R$ 10.520 | R$ 1.500 | R$ 9.020 |
| 100 | 25 Starter + 55 Pro + 20 Ent | R$ 23.190 | R$ 3.000 | R$ 20.190 |

### Custo Variável por Tenant

| Item | Custo/tenant/mês | Nota |
|------|-----------------|------|
| Evolution API (RAM) | R$ 0 | ~50-100MB RAM por instance, diluído na VPS |
| PostgreSQL (storage) | R$ 0 | ~50MB/tenant/mês, diluído na VPS |
| IA tokens (acima do free) | R$ 0-15 | Só se ultrapassar free tier dos 6 provedores |
| Asaas (taxa por cobrança) | R$ 0-2 | PIX gratuito, boleto R$ 1,99 |
| **Total variável** | **~R$ 0-17** | |

---

## 13. CHECKLIST GO-TO-MARKET

### Antes do Beta

```
PRODUTO
  □ Multi-tenancy funcionando e testado
  □ HQ com provisioning automático
  □ Demo com tour guiado
  □ Landing page com preços e form de trial
  □ Onboarding wizard funcional
  □ Billing integrado (pelo menos manual/PIX)

LEGAL
  □ Termos de Uso (luna)
  □ Política de Privacidade (LGPD)
  □ Contrato de SaaS / Termos de Serviço
  □ DPA (Data Processing Agreement) — opcional mas recomendado

OPERAÇÃO
  □ Email de suporte configurado (suporte@lunacrm.com.br)
  □ WhatsApp de suporte (número da EB Develop)
  □ Documentação de uso básico (5 artigos)
  □ Vídeo de onboarding (3-5 min)
  □ Script de vendas para demo ao vivo
  □ Processo de setup de cliente (checklist interno)

MARKETING
  □ Perfil Instagram @lunacrm (com prints do produto)
  □ 3-5 posts de lançamento
  □ Case study Clínica Mykaele (com permissão)
  □ Lista de 50 clínicas target (Fortaleza primeiro, depois BR)
  □ Mensagem de prospecção WhatsApp (template)
```

### Após o Beta (30 dias)

```
□ Coletar NPS dos pilotos
□ Identificar top 3 pedidos de feature
□ Ajustar preços se necessário
□ Criar programa de indicação (tenant indica tenant → desconto)
□ Implementar multi-canal (Instagram DM) — se demanda alta
□ Automatizar onboarding (reduzir tempo do setup manual)
□ Setup monitoring (Sentry ou similar)
□ Documentar runbook de incidentes
```

---

## RESUMO EXECUTIVO

| Item | Quantidade | Status |
|------|-----------|--------|
| **Models Prisma novos** | 5 (SubscriptionPlan, Subscription, UsageMetric, BillingEvent, DemoSession) |
| **Arquivos novos** | ~30 (HQ pages, APIs, libs, seed, landing) |
| **Arquivos refatorados** | ~30 (trocar DEFAULT_TENANT_ID → getTenantId) |
| **Tempo estimado** | 8 semanas (1 dev full-time) |
| **Investimento infra** | R$ 153/mês inicial |
| **Break-even** | 2 clientes Pro (R$ 394/mês) |
| **Receita com 50 clientes** | ~R$ 10.500/mês |

---

## 14. DECISÕES ESTRATÉGICAS (DEFINIDAS)

> Postura: Tech Lead escalando produto B2B SaaS para clínicas de estética corporal e harmonização facial.

### 14.1 — O PRODUTO: Site + CRM (não só CRM)

O cliente compra **duas coisas juntas** — não uma:

```
PACOTE LUNA = SITE DA CLÍNICA + CRM LUNA

SITE (o que o cliente vê de fora):
  ├── Landing page premium da clínica (template customizável)
  ├── Vitrine de procedimentos com preços
  ├── Galeria de antes/depois
  ├── Agendamento online
  ├── Portal do paciente (histórico, acompanhamento)
  ├── SEO otimizado (Google Meu Negócio)
  ├── PWA instalável
  └── Domínio próprio do cliente (drajuliana.com.br)

CRM (o que a equipe usa por dentro):
  ├── Pipeline Kanban
  ├── Inbox WhatsApp
  ├── IA + RAG + Concierge
  ├── Radar de Retenção Biológico ← KILLER FEATURE
  ├── Janela de Ouro
  ├── Automações + Bot
  ├── Relatórios + NPS
  └── Propostas + Broadcast
```

**Por que vender junto:** O site é a porta de entrada. Se o cliente já tem site, o CRM não faz sentido sozinho (de onde vêm os leads?). Se tem CRM sem site, perde metade do funil. A Mykaele já prova que funciona junto.

### 14.2 — RADAR DE RETENÇÃO BIOLÓGICO (Killer Feature)

Este é o **ÚNICO motivo** pelo qual uma clínica paga R$ 197-497/mês e NÃO volta pro Kommo.

```
COMO FUNCIONA:

1. Paciente faz Botox em 15/Jan
2. Luna registra: "Botox, ciclo biológico = 120 dias, retorno ideal = 15/Mai"
3. Automações:
   - Dia 90  (15/Abr): "Oi Maria, tudo bem? Seu Botox está próximo da renovação"
   - Dia 105 (30/Abr): "Agende sua renovação esta semana e ganhe 10% de desconto"
   - Dia 115 (10/Mai): "⚠️ ALERTA CLÍNICA: Maria não agendou. Risco de churn: 85%"
   - Dia 120 (15/Mai): "Maria está 120 dias sem retorno. Ligar HOJE."
4. Lead aparece no Radar com indicador vermelho pulsando
5. Se não agendar em 30 dias, status vira "CHURN CONFIRMADO"

PROCEDIMENTOS E CICLOS (customizáveis por clínica):

┌───────────────────────┬──────────┬───────────┬──────────────────────┐
│ Procedimento          │ Follow-up│  Retorno  │ Janela de Reativação │
├───────────────────────┼──────────┼───────────┼──────────────────────┤
│ Botox                 │  15 dias │  120 dias │  90-135 dias         │
│ Preenchimento Labial  │   7 dias │  270 dias │ 240-300 dias         │
│ Harmonização Facial   │  15 dias │  180 dias │ 150-210 dias         │
│ Bioestimuladores      │  30 dias │  180 dias │ 150-210 dias         │
│ Skinbooster           │   7 dias │   90 dias │  75-105 dias         │
│ Peeling Químico       │   7 dias │   90 dias │  75-105 dias         │
│ Microagulhamento      │  30 dias │   90 dias │  75-105 dias         │
│ Limpeza de Pele       │   3 dias │   30 dias │  25-40 dias          │
│ Drenagem Linfática    │   1 dia  │    7 dias │   5-10 dias          │
│ Criolipólise          │  15 dias │  180 dias │ 150-210 dias         │
│ Laser CO2             │  30 dias │  365 dias │ 300-400 dias         │
│ Fios de PDO           │   7 dias │  180 dias │ 150-210 dias         │
│ Enzimas (Lipólise)    │   3 dias │   21 dias │  18-28 dias          │
│ Sculptra              │  30 dias │  730 dias │ 670-760 dias         │
│ [CUSTOM]              │  config  │  config   │ config               │
└───────────────────────┴──────────┴───────────┴──────────────────────┘

NA DEMO:
  → Mostrar 3 pacientes com Botox vencendo esta semana
  → Gráfico: "R$ 12.800 em procedimentos vencendo nos próximos 30 dias"
  → Automação disparando mensagem de reativação
  → Score de risco de churn subindo em tempo real

PITCH DE VENDA:
  "Quanto sua clínica perde por mês porque pacientes esquecem
   de renovar o Botox? Com o Luna, isso NUNCA acontece.
   O sistema sabe quando cada procedimento vence e avisa
   sua equipe ANTES da paciente sumir."
```

### 14.3 — INFRA: VPS SEPARADA OU COMPARTILHADA?

```
DECISÃO: VPS ÚNICA GRANDE (escala vertical primeiro)

POR QUÊ:
  ├── Coolify já funciona
  ├── Você é 1 dev — não precisa de Kubernetes agora
  ├── Multi-tenant por software (tenantId) = 1 app serve N clientes
  ├── VPS de 16GB RAM suporta ~30-40 clientes tranquilo
  ├── Custo: R$ 200-300/mês vs R$ 100/mês POR CLIENTE se separar
  └── G4 Rule: "Escala vertical até doer, depois horizontal"

PLANO DE CRESCIMENTO:

Até 20 clientes:
  └── 1 VPS 16GB (Hetzner CX32 = ~€19/mês ≈ R$110)
      ├── Next.js (app)
      ├── PostgreSQL 16
      ├── Redis 7
      ├── Evolution API
      └── BullMQ Worker

20-50 clientes:
  └── 1 VPS 32GB (Hetzner CX42 = ~€36/mês ≈ R$210)
      ├── Tudo igual, mais RAM
      └── Ou: 2 VPS (app+db em uma, Evolution+Worker na outra)

50-100 clientes:
  └── 2-3 VPS no Coolify
      ├── VPS 1: App + Worker (16GB)
      ├── VPS 2: PostgreSQL + Redis (16GB)
      └── VPS 3: Evolution API dedicada (8GB)

100+ clientes:
  └── Considerar managed services
      ├── Neon (PostgreSQL managed)
      ├── Upstash (Redis managed)
      └── App continua no Coolify

REGRA: NÃO comprar VPS separada por cliente.
       1 VPS grande > 10 VPS pequenas (custo, manutenção, deploy).
```

### 14.4 — EVOLUTION API: 1 POR CLIENTE (agora), META (futuro)

```
FASE 1 (AGORA) — Evolution API Multi-Instance:
  ├── 1 instalação do Evolution API na VPS
  ├── Cada cliente cria uma "instance" (= 1 número WhatsApp)
  ├── Evolution suporta múltiplas instances nativamente
  ├── Cada instance = ~50-100MB RAM
  ├── VPS 16GB = ~100 instances possíveis
  ├── Webhook: instanceId identifica o tenant
  └── QR Code na tela de settings do CRM do cliente

FASE 2 (6-12 MESES) — Meta Business API (WhatsApp Official):
  ├── API oficial do WhatsApp (sem risco de ban)
  ├── Cada clínica precisa de Meta Business verificado
  ├── Templates pré-aprovados pela Meta
  ├── Sem QR Code — conexão permanente
  ├── Custo: $0.05-0.08/conversa (pago pelo cliente)
  ├── Permite: botões interativos, catálogos, pagamentos
  └── NÃO substitui Evolution — é um SEGUNDO canal

MIGRAÇÃO EVOLUTION → META:
  ├── Model CrmChannel já suporta type: 'whatsapp_evolution' | 'whatsapp_meta'
  ├── Abstração no evolution-api.ts → cria interface unificada
  ├── Cliente escolhe: Evolution (grátis, risco ban) ou Meta (pago, sem risco)
  └── Pode ter os dois ativos simultaneamente

RISCO DO EVOLUTION API:
  ├── WhatsApp pode banir números que usam API não oficial
  ├── Mitigação: orientar cliente a usar número dedicado (não o pessoal)
  ├── Na demo: simulador, sem Evolution real
  └── No contrato: "EB Develop não se responsabiliza por bans do WhatsApp"
```

### 14.5 — WHITE-LABEL

```
DECISÃO: SIM, mas só no plano Enterprise (R$ 497/mês)

O QUE MUDA NO WHITE-LABEL:
  ├── Logo da clínica no lugar do Luna
  ├── Cores customizáveis (bg, accent, text — via CSS vars)
  ├── Favicon e título da aba
  ├── Email "de" com domínio do cliente (via Resend)
  ├── Domínio próprio: crm.drajuliana.com.br (CNAME)
  └── Remove "Powered by Luna" do rodapé

O QUE NÃO MUDA:
  ├── Código é o mesmo (apenas CSS vars + config no tenant)
  ├── Infra é a mesma (mesmo app, mesmo banco)
  ├── Admin HQ continua vendo o tenant normalmente
  └── Funcionalidades são as mesmas

IMPLEMENTAÇÃO:
  CrmTenant recebe campos opcionais:
    customLogo     String?    // URL do logo
    customColors   Json?      // { bg, surface, accent, text }
    customDomain   String?    // crm.drajuliana.com.br
    whiteLabel     Boolean    @default(false)

  Coolify: wildcard SSL para *.lunacrm.com.br
  Custom domain: CNAME do cliente → app.lunacrm.com.br
  Middleware resolve tenant pelo domain se custom
```

### 14.6 — DOMÍNIO DO CLIENTE (Site + CRM)

```
MODELO DE DOMÍNIOS:

LUNA PLATFORM (EB Develop):
  lunacrm.com.br              → Landing page de vendas
  app.lunacrm.com.br          → Login + seletor de tenant
  demo.lunacrm.com.br         → Demo (acesso público)
  hq.lunacrm.com.br           → Admin Central (só super admin)

CLIENTE (Starter/Pro):
  [slug].lunacrm.com.br       → Site da clínica (ex: mykaele.lunacrm.com.br)
  app.lunacrm.com.br          → CRM (mesmo app, tenant resolvido por login)

CLIENTE (Enterprise — white-label):
  drajuliana.com.br            → Site da clínica (domínio próprio)
  crm.drajuliana.com.br        → CRM (CNAME → app.lunacrm.com.br)

IMPLEMENTAÇÃO:
  ├── Coolify: wildcard *.lunacrm.com.br (1 certificado)
  ├── Custom domain: adicionar no Coolify como alias
  ├── Middleware resolve tenant:
  │     1. Custom domain → busca CrmTenant.customDomain
  │     2. Subdomínio → busca CrmTenant.slug
  │     3. JWT tenantId → fallback
  └── DNS: cliente configura CNAME apontando para app.lunacrm.com.br
```

### 14.7 — BILLING (Cobrança Automática)

```
EXPLICAÇÃO SIMPLES:
  Billing = sistema que cobra o cliente todo mês automaticamente.
  Sem billing, você precisa cobrar na mão (PIX, boleto avulso).

RECOMENDAÇÃO: ASAAS

O QUE É O ASAAS:
  ├── Plataforma brasileira de cobranças
  ├── Cria "assinatura" = cobra automaticamente todo mês
  ├── Aceita: PIX (grátis), boleto (R$ 1,99), cartão (2,99%)
  ├── Envia email de cobrança automaticamente
  ├── Webhook avisa quando pagou ou quando falhou
  ├── Dashboard financeiro incluso
  └── API REST simples

FLUXO:
  1. Você cria conta no Asaas (asaas.com)
  2. No provisioning do tenant → cria "customer" no Asaas
  3. Cria "subscription" (assinatura mensal)
  4. Asaas envia cobrança todo mês (email + link de pagamento)
  5. Cliente paga → Asaas envia webhook → Luna ativa/renova tenant
  6. Cliente NÃO paga → Asaas envia webhook → Luna suspende após 7 dias
  7. Dinheiro cai na SUA conta do Asaas → transfere para banco

ALTERNATIVA MAIS SIMPLES (MVP):
  ├── Cobrar via PIX manual (envia QR Code)
  ├── Marcar pagamento manualmente no HQ
  ├── Sem automação de suspensão
  └── Funciona até 10-15 clientes, depois vira caos

DECISÃO: Asaas desde o início. R$ 0 de mensalidade, só paga taxa por cobrança.
```

---

## 15. MODELO DE NEGÓCIO COMPLETO — SITE + CRM

### 15.1 — Planos Revisados (Site + CRM)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         PLANOS LUNA                                      │
├──────────────┬──────────────┬──────────────┬────────────────────────────┤
│              │   STARTER    │     PRO      │       ENTERPRISE           │
│              │  R$ 197/mês  │  R$ 397/mês  │     R$ 797/mês            │
├──────────────┼──────────────┼──────────────┼────────────────────────────┤
│ SITE         │              │              │                            │
│ Template     │ 1 (fixo)     │ 3 opções     │ Custom (design exclusivo)  │
│ Domínio      │ slug.luna    │ slug.luna    │ Domínio próprio            │
│ SEO          │ Básico       │ Completo     │ Completo + Schema.org      │
│ Galeria      │ 20 fotos     │ 100 fotos   │ Ilimitado                  │
│ Agendamento  │ ✅           │ ✅           │ ✅                         │
│ Portal pac.  │ ❌           │ ✅           │ ✅                         │
├──────────────┼──────────────┼──────────────┼────────────────────────────┤
│ CRM          │              │              │                            │
│ Pipelines    │ 1            │ 3            │ Ilimitado                  │
│ Leads        │ 500          │ 5.000        │ Ilimitado                  │
│ WhatsApp     │ 1 número     │ 2 números    │ 5 números                  │
│ Equipe       │ 2 usuários   │ 5 usuários   │ Ilimitado                  │
│ Automações   │ 3            │ Ilimitado    │ Ilimitado                  │
│ Bot visual   │ ❌           │ ✅           │ ✅                         │
│ Templates    │ 5            │ 50           │ Ilimitado                  │
│ Broadcast    │ ❌           │ ✅           │ ✅                         │
├──────────────┼──────────────┼──────────────┼────────────────────────────┤
│ IA           │              │              │                            │
│ Score IA     │ ❌           │ ✅           │ ✅                         │
│ Janela Ouro  │ ❌           │ ✅           │ ✅                         │
│ Radar Biol.  │ Básico (3p)  │ Completo     │ Completo + Custom ciclos   │
│ Concierge    │ ❌           │ ✅           │ ✅ + RAG avançado          │
│ RAG docs     │ 1            │ 10           │ Ilimitado                  │
├──────────────┼──────────────┼──────────────┼────────────────────────────┤
│ RELATÓRIOS   │              │              │                            │
│ Dashboard    │ Básico       │ Completo     │ Completo + Export PDF      │
│ ROI          │ ❌           │ ✅           │ ✅                         │
│ NPS          │ ❌           │ ✅           │ ✅                         │
│ Propostas    │ ❌           │ ✅           │ ✅                         │
├──────────────┼──────────────┼──────────────┼────────────────────────────┤
│ EXTRAS       │              │              │                            │
│ White-label  │ ❌           │ ❌           │ ✅                         │
│ API acesso   │ ❌           │ ❌           │ ✅                         │
│ Meta API     │ ❌           │ ❌           │ ✅ (quando disponível)     │
│ Suporte      │ Email        │ WA + Email   │ WA prioritário + call      │
│ Onboarding   │ Self-service │ Assistido    │ Dedicado (2h)              │
└──────────────┴──────────────┴──────────────┴────────────────────────────┘

NOTA sobre "Radar Biológico Básico (3p)":
  Starter inclui 3 procedimentos fixos: Botox, Preenchimento, Harmonização.
  Pro/Enterprise: todos os procedimentos + custom.
```

### 15.2 — Unit Economics Revisado

```
RECEITA POR CLIENTE:

  Starter:    R$ 197/mês × 12 = R$ 2.364/ano
  Pro:        R$ 397/mês × 12 = R$ 4.764/ano
  Enterprise: R$ 797/mês × 12 = R$ 9.564/ano

CUSTO POR CLIENTE:

  Infra (diluído):     ~R$ 10-20/mês
  Evolution API (RAM):  ~R$ 0 (diluído na VPS)
  IA tokens (cascade):  ~R$ 0-15/mês (free tier cobre maioria)
  Asaas (billing):      ~R$ 2/mês (1 cobrança PIX)
  Suporte (seu tempo):  ~R$ 50-100/mês (estimado em horas)
  ────────────────────────────────────────
  TOTAL:                ~R$ 62-137/mês por cliente

MARGEM:
  Starter:    R$ 197 - R$ 62  = R$ 135 (68% margem)
  Pro:        R$ 397 - R$ 100 = R$ 297 (75% margem)
  Enterprise: R$ 797 - R$ 137 = R$ 660 (83% margem)

BREAK-EVEN:
  VPS 16GB = R$ 110/mês
  Domínio = R$ 3/mês
  → 1 cliente Starter já paga a infra
  → A partir do 2o cliente é lucro líquido

PROJEÇÃO 12 MESES:
  Mês 1-3:   5 clientes  (3 Starter + 2 Pro)  = R$ 1.385/mês
  Mês 4-6:  15 clientes  (8 S + 5 P + 2 E)    = R$ 4.955/mês
  Mês 7-9:  30 clientes  (12 S + 13 P + 5 E)  = R$ 11.500/mês
  Mês 10-12: 50 clientes (18 S + 22 P + 10 E) = R$ 20.220/mês
```

### 15.3 — Funil de Vendas

```
AQUISIÇÃO (como chegar nas clínicas):

  1. INSTAGRAM — 60% dos leads
     ├── Perfil @lunacrm com prints premium do sistema
     ├── Reels: "Sua clínica ainda usa planilha? 👀"
     ├── Ads: R$ 500-1.000/mês target "dono de clínica estética"
     └── DM: prospect comenta → link da demo

  2. INDICAÇÃO — 20% dos leads
     ├── Cliente indica cliente → 1 mês grátis para ambos
     ├── Parceiro (consultor de clínicas) → 15% recorrente
     └── Comunidades de estética (Facebook, Telegram)

  3. GOOGLE — 15% dos leads
     ├── SEO: "CRM para clínica de estética"
     ├── Google Ads: R$ 300-500/mês
     └── Landing page otimizada para conversão

  4. EVENTO/CONGRESSO — 5% dos leads
     ├── Congressos de estética (stand ou palestrante)
     └── Workshops online "Como não perder pacientes"

CONVERSÃO (da demo até fechar):

  Lead chega → Demo online (15 min)
    → Trial 14 dias
      → Follow-up dia 3, 7, 10, 13
        → Pagamento → Cliente ativo

  Taxa estimada: 15-25% do trial converte em pagante
  CAC (custo de aquisição): R$ 100-300 por cliente
  LTV (lifetime value): R$ 197 × 18 meses = R$ 3.546 (Starter)
  LTV/CAC ratio: 12-35x (excelente)
```

---

## 16. ROADMAP DE PRODUTO (PÓS-LANÇAMENTO)

```
TRIMESTRE 1 — FUNDAÇÃO (Semana 1-8)
  ✅ Multi-tenancy
  ✅ Admin Central (HQ)
  ✅ Demo
  ✅ Landing page
  ✅ Billing
  ✅ Beta com 5 clínicas

TRIMESTRE 2 — CRESCIMENTO
  □ App mobile (PWA otimizado → notificações push reais)
  □ Meta Business API (WhatsApp oficial)
  □ Multi-canal: Instagram DM (API oficial)
  □ Templates de site (3 opções visuais)
  □ Agendamento online no site do cliente
  □ Integração com Google Meu Negócio
  □ API pública para Enterprise
  □ Programa de indicação automatizado

TRIMESTRE 3 — DIFERENCIAÇÃO
  □ Prontuário digital integrado ao CRM
  □ Fotos antes/depois com IA (comparação automática)
  □ Ficha de anamnese digital (assinatura eletrônica)
  □ Split de pagamento (Mercado Pago por tenant)
  □ Marketplace de automações (templates compartilhados)
  □ Integração com Doctoralia / iClinic
  □ Dashboard do paciente (acompanhamento pós)

TRIMESTRE 4 — ESCALA
  □ Multi-idioma (espanhol para LatAm)
  □ Migração para Kubernetes se >100 clientes
  □ SLA garantido para Enterprise
  □ SOC 2 compliance (se necessário)
  □ Partner program (revendedores)
  □ Integração com ERPs de saúde
```

---

*SAAS-SCOPE.md v2.0 — Março 2026*
*De protótipo para plataforma SaaS vendável em massa*
*EB Develop → Luna CRM Platform*
*Nicho: Clínicas de Estética Corporal e Harmonização Facial*
