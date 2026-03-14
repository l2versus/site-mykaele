# BÍBLIA DO PROJETO — Luna CRM + Clínica Mykaele Procópio

> **Documento completo de todas as funcionalidades, features, tecnologias e integrações**
> Da fundação até hoje — Março 2026
>
> **47 models · 133+ APIs · 50+ páginas admin · 20+ integrações**

---

## ÍNDICE

1. [Identidade e Visão](#1-identidade-e-visão)
2. [Stack Tecnológica Completa](#2-stack-tecnológica-completa)
3. [Arquitetura Geral](#3-arquitetura-geral)
4. [Banco de Dados — 47 Models](#4-banco-de-dados--47-models)
5. [Módulo Clínica (Legacy)](#5-módulo-clínica-legacy)
6. [Módulo CRM — Luna](#6-módulo-crm--colify)
7. [Inteligência Artificial](#7-inteligência-artificial)
8. [Automações e Bots](#8-automações-e-bots)
9. [Integrações Externas](#9-integrações-externas)
10. [Sistema de Autenticação](#10-sistema-de-autenticação)
11. [Tempo Real (SSE + Redis)](#11-tempo-real-sse--redis)
12. [Workers e Filas (BullMQ)](#12-workers-e-filas-bullmq)
13. [Design System](#13-design-system)
14. [Todas as Páginas](#14-todas-as-páginas)
15. [Todas as APIs](#15-todas-as-apis)
16. [Componentes](#16-componentes)
17. [Hooks e Stores](#17-hooks-e-stores)
18. [Server Actions](#18-server-actions)
19. [Segurança e LGPD](#19-segurança-e-lgpd)
20. [Infraestrutura e Deploy](#20-infraestrutura-e-deploy)
21. [Variáveis de Ambiente](#21-variáveis-de-ambiente)
22. [Cronologia do Projeto](#22-cronologia-do-projeto)
23. [Métricas do Codebase](#23-métricas-do-codebase)
24. [Vantagens Competitivas vs Kommo](#24-vantagens-competitivas-vs-kommo)

---

## 1. IDENTIDADE E VISÃO

| Campo | Valor |
|---|---|
| **Produto** | SaaS / CRM premium para clínicas de estética de luxo |
| **Nome Comercial** | Luna CRM |
| **Dev/CEO** | EB Develop |
| **Cliente V1** | Clínica Mykaele Procópio (Fortaleza, CE) |
| **Benchmark** | Kommo CRM — superar em 10x |
| **URL Produção** | mykaprocopio.com.br |
| **Hospedagem** | VPS via Coolify (Docker Compose) |
| **Idioma** | Português do Brasil (pt-BR) |

**Missão:** Ninguém agenda R$4.000 em procedimento conversando com bot engessado. O Luna empodera a recepcionista com contexto instantâneo, IA RAG que conhece os protocolos da clínica, e UX de aplicativo nativo Apple.

---

## 2. STACK TECNOLÓGICA COMPLETA

### Framework e Linguagem
| Tecnologia | Versão | Uso |
|---|---|---|
| Next.js (App Router) | 16.1.6 | Framework full-stack |
| TypeScript | 5.x | Linguagem (modo estrito, zero `any`) |
| React | 19.x | UI library |
| Node.js | 22+ | Runtime |

### Banco de Dados e ORM
| Tecnologia | Versão | Uso |
|---|---|---|
| PostgreSQL | 16 | Banco relacional principal |
| Prisma | 7.4.1 | ORM com adapter `@prisma/adapter-pg` |
| pgvector | ext | Busca vetorial (embeddings IA) |
| Redis | 7-alpine | Cache, filas, pub/sub, presença |

### Frontend
| Tecnologia | Versão | Uso |
|---|---|---|
| Tailwind CSS | 4.x | Estilização (modo escuro obrigatório) |
| Framer Motion | 12.35.2 | Animações com física real |
| GSAP | 3.x | Animações avançadas |
| @hello-pangea/dnd | 18.0.1 | Drag & drop (Kanban) |
| @xyflow/react (React Flow) | 12.10.1 | Construtor visual de bots |
| Zustand | 5.0.11 | Estado global |
| Recharts | 3.7.0 | Gráficos e relatórios |
| Leaflet | 1.9.4 | Mapas GPS |

### Backend e Infraestrutura
| Tecnologia | Versão | Uso |
|---|---|---|
| BullMQ | 5.70.4 | Filas de processamento |
| IORedis | 7.x | Cliente Redis |
| jsonwebtoken | 9.0.3 | JWT auth |
| bcryptjs | 2.4.3 | Hash de senhas |
| node-cron | 4.2.1 | Tarefas agendadas |

### Integrações
| Tecnologia | Versão | Uso |
|---|---|---|
| Evolution API | 2.2.3 | WhatsApp bidirecional |
| Mercado Pago SDK | 2.12.0 | Pagamentos |
| Resend | 6.9.3 | Envio de emails |
| OpenAI SDK | 6.27.0 | Embeddings + chat IA |
| Cloudinary | 2.9.0 | CDN de imagens |
| pdf-parse | 2.4.5 | Extração de texto de PDFs |

### Mobile/PWA
| Tecnologia | Uso |
|---|---|
| PWA (Service Worker) | App instalável |
| WebAuthn/Passkeys | Login biométrico |
| Vibration API | Feedback tátil |
| Web Audio | Sons de notificação |

---

## 3. ARQUITETURA GERAL

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                │
│  Next.js App Router (Server + Client Components)                │
│  Zustand · Framer Motion · Tailwind · React Flow                │
├─────────────────────────────────────────────────────────────────┤
│                      API LAYER                                  │
│  133+ API Routes · Server Actions · SSE Stream                  │
├──────────┬──────────┬───────────────┬───────────────────────────┤
│ PostgreSQL│  Redis   │  Evolution API │  OpenAI / Gemini        │
│ + pgvector│  BullMQ  │  (WhatsApp)    │  (Embeddings + Chat)    │
├──────────┴──────────┴───────────────┴───────────────────────────┤
│                      WORKERS (processo separado)                │
│  process-webhook · calculate-ai-score · golden-window           │
│  retention-radar · execute-automation · reconcile-messages       │
├─────────────────────────────────────────────────────────────────┤
│                      INFRAESTRUTURA                             │
│  Docker Compose · Coolify · PostgreSQL 16 · Redis 7             │
└─────────────────────────────────────────────────────────────────┘
```

### Padrões Arquiteturais
- **Server Components** por padrão — `"use client"` só nas folhas
- **Server Actions** para mutações (não API routes internos)
- **useOptimistic** para feedback imediato (drag & drop)
- **Índice Fracionário** para posição de cards no Kanban
- **Multi-tenant** via `tenantId` em todos os models CRM
- **Exclusão lógica** (`deletedAt`) em leads — nunca DELETE
- **Criptografia AES-256-GCM** para credenciais de integração

---

## 4. BANCO DE DADOS — 47 MODELS

### Módulo Clínica (27 models originais)
```
User                    — Usuários (admin + pacientes)
EmailVerificationToken  — Tokens de verificação de email
Service                 — Serviços/procedimentos oferecidos
PackageOption           — Opções de pacote
Package                 — Pacotes de sessões
Appointment             — Agendamentos
Schedule                — Grade horária
BlockedDate             — Datas bloqueadas
Payment                 — Pagamentos
Expense                 — Despesas
BodyMeasurement         — Medidas corporais
SessionFeedback         — Feedback pós-sessão
CareGuideline           — Cuidados pós-sessão
Anamnese                — Ficha de anamnese
ReferralCode            — Códigos de indicação
Referral                — Indicações realizadas
LoyaltyPoints           — Saldo de pontos
LoyaltyTransaction      — Transações de pontos
LoyaltyReward           — Recompensas do programa
InventoryItem           — Itens de estoque
StockMovement           — Movimentações de estoque
Waitlist                — Lista de espera
GiftCard                — Gift cards
TreatmentProtocol       — Protocolos de tratamento
SiteSettings            — Configurações do site
DigitalReceipt          — Recibos digitais
GalleryImage            — Galeria de imagens
```

### Módulo CRM — Luna (20 models)

**Core CRM**
```
CrmTenant         — Multi-tenancy (clínicas)
Lead              — Leads com status (COLD/WARM/HOT/WON/LOST)
LeadActivity      — Timeline de atividades do lead
Pipeline          — Pipelines de vendas
Stage             — Estágios do Kanban (OPEN/WON/LOST)
Conversation      — Conversas WhatsApp vinculadas a leads
Message           — Mensagens individuais com sentimento/resumo IA
CrmChannel        — Canais de comunicação (WhatsApp, email)
CrmIntegration    — Credenciais de integração (criptografadas)
CrmAuditLog       — Log de auditoria LGPD
```

**IA e Automação**
```
CrmAiConfig       — Configuração do provedor de IA
CrmKnowledgeBase  — Base RAG com embeddings vetoriais
CrmAutomation     — Regras de automação (DAG JSON)
CrmAutomationLog  — Histórico de execução
CrmBotFlow        — Fluxos visuais do bot (nós/arestas React Flow)
CrmBotSession     — Sessões ativas de bot por lead
```

**Operacional**
```
CrmNotification        — Notificações in-app
CrmNotificationSetting — Preferências de notificação por usuário
CrmTask                — Tarefas/lembretes atribuídos à equipe
CrmTemplate            — Templates de mensagem (WhatsApp/Email)
CrmTeamMember          — Membros da equipe com roles e convites
```

**Relatórios e Growth**
```
CrmBroadcast          — Campanhas de envio em massa
CrmBroadcastRecipient — Destinatários com tracking de entrega
CrmProposal           — Propostas/orçamentos
CrmProposalItem       — Itens das propostas
CrmNpsConfig          — Configuração de pesquisa NPS
CrmNpsResponse        — Respostas NPS
CrmMarketingSpend     — Gastos de marketing por fonte
CrmActivityLog        — Log geral de atividades
CrmGoal               — Metas de receita por mês
```

---

## 5. MÓDULO CLÍNICA (LEGACY)

### 5.1 — Agendamento
- Calendário de horários com grade configurável
- Bloqueio de datas e horários
- Disponibilidade em tempo real
- Agendamento pelo app do paciente
- Deslocamento (para atendimentos a domicílio)
- GPS em tempo real com Leaflet + SSE

### 5.2 — Pacientes
- Cadastro completo com anamnese digital
- Medidas corporais com evolução gráfica
- Histórico de sessões e feedback
- Portal do paciente (self-service)
- Login social (Google, Instagram)
- Login biométrico (WebAuthn/Passkeys)

### 5.3 — Serviços e Pacotes
- Catálogo de procedimentos com preços
- Pacotes de sessões (ex: 10 sessões de drenagem)
- Créditos por pacote consumidos automaticamente
- Protocolos de tratamento documentados

### 5.4 — Financeiro
- Pagamentos via Mercado Pago (PIX, cartão, boleto)
- Controle de despesas
- Relatórios financeiros
- Comissões por profissional
- Pró-labore
- Recibos digitais automáticos
- Gift cards (venda e resgate)

### 5.5 — Fidelidade
- Programa de pontos com tiers VIP
- Transações de pontos (ganho/resgate)
- Recompensas configuráveis
- Integração com agendamentos

### 5.6 — Indicações
- Códigos de indicação únicos por paciente
- Tracking de indicações realizadas
- Descontos automáticos para indicador e indicado

### 5.7 — Estoque
- Controle de itens com quantidade
- Movimentações (entrada/saída)
- Alertas de estoque baixo

### 5.8 — Lista de Espera
- Cadastro de interessados por serviço
- Notificação quando vaga abrir

### 5.9 — Site Público
- Landing page com seções dinâmicas
- Galeria de resultados (antes/depois)
- Galeria de vídeos
- FAQ interativo
- Depoimentos de clientes
- Showcase do app
- WhatsApp flutuante
- SEO otimizado

### 5.10 — Email Marketing
- Templates luxuosos (HTML inline)
- Email pós-sessão com medidas e cuidados
- Email de verificação de conta
- Email de convite para equipe CRM

---

## 6. MÓDULO CRM — COLIFY

### 6.1 — Pipeline Kanban
- Múltiplos pipelines por tenant
- Estágios customizáveis (OPEN, WON, LOST)
- Drag & drop com física real (inclinação 1.5°, sombra profunda)
- Índice fracionário para posicionamento de cards
- Contadores em cache (leads + valor total por estágio)
- Atualização em tempo real via SSE
- Tags, valor esperado, fonte de aquisição
- Filtros por status, data, valor, responsável

### 6.2 — Gestão de Leads
- CRUD completo com exclusão lógica
- Status: COLD → WARM → HOT → WON / LOST
- Score de IA (0-100) com label
- Risco de churn calculado
- Janela de Ouro (melhor dia/hora para contato)
- Vinculação opcional com Patient (sistema legado)
- Vinculação com Appointment
- Timeline de atividades
- Importação em massa
- Conversão para paciente

### 6.3 — Caixa de Entrada (Inbox)
- Conversas WhatsApp em tempo real
- Marcação de leitura
- Resumo por IA de cada conversa
- Análise de sentimento por mensagem
- Suporte a tipos: texto, imagem, áudio, vídeo, documento
- Cofre de mídia clínica (fotos de antes/depois)
- Atribuição de responsável por conversa

### 6.4 — Contatos
- Lista de contatos com busca e filtros
- Detalhes do lead com LTV, pacotes ativos, histórico
- Merge de contatos duplicados (por telefone)

### 6.5 — Inteligência
- **Score de IA:** Pontuação 0-100 baseada em interações, tempo de resposta, engagement
- **Janela de Ouro:** Análise estatística de quando o lead responde mais (dia da semana + horário)
- **Radar de Retenção:** Previsão de churn baseada no ciclo biológico do procedimento
- **Concierge RAG:** IA sugere respostas baseadas nos protocolos reais da clínica

### 6.6 — Base de Conhecimento (RAG)
- Upload de PDFs (protocolos, manuais, FAQs)
- Extração de texto via `pdf-parse`
- Chunking inteligente (500 tokens por chunk)
- Embeddings via OpenAI `text-embedding-3-small` (1536 dimensões)
- Busca vetorial via pgvector
- Reprocessamento de documentos

### 6.7 — Templates de Mensagem
- Templates pré-aprovados para WhatsApp
- Variáveis dinâmicas (nome, procedimento, data)
- Templates de email
- Categorização por tipo

### 6.8 — Broadcast (Envio em Massa)
- Campanhas para múltiplos leads
- Seleção por filtros (estágio, tag, status)
- Tracking de entrega por destinatário
- Agendamento de envio

### 6.9 — Propostas/Orçamentos
- Criação de propostas com itens e descontos
- Link público com token único (`/proposta/[token]`)
- Status: DRAFT → SENT → VIEWED → ACCEPTED → REJECTED → EXPIRED
- Tracking de visualização
- Validade configurável

### 6.10 — NPS (Net Promoter Score)
- Pesquisas automáticas pós-atendimento
- Coleta de score (0-10) + comentário
- Dashboard com métricas NPS
- Segmentação: Promotores / Neutros / Detratores

### 6.11 — Equipe
- Múltiplos membros por tenant
- Roles: owner, admin, manager, agent
- Convite por email com link único (`/convite/[token]`)
- Criação de senha e vinculação automática
- Comissão por % sobre leads ganhos
- Ativação/desativação de membros
- Métricas de produtividade (leads atribuídos, conversas)

### 6.12 — Webhooks
- Webhooks de entrada (receber dados de sistemas externos)
- Webhooks de saída (enviar eventos para sistemas externos)
- Log de execução com retry
- Configuração por evento

### 6.13 — Relatórios (8 tipos)
1. **Overview** — KPIs principais (leads, conversões, receita)
2. **Consolidado** — Funil de leads + taxa de conversão por estágio
3. **Atividades** — Log de ações com exportação CSV
4. **Comunicações** — Analytics de mensagens (volume, tempo de resposta)
5. **ROI** — Retorno por fonte de marketing (gasto vs receita)
6. **Ganhos/Perdas** — Análise de motivos de perda
7. **Metas** — Acompanhamento de metas vs realizado
8. **Dashboard CRM** — Visão geral com gráficos

### 6.14 — Configurações CRM
- Configuração do tenant (nome, slug)
- Configuração do agente IA (provedor, modelo, temperatura)
- Integrações (WhatsApp connect, status, diagnóstico)
- Notificações (preferências por tipo)

### 6.15 — Sistema (Admin)
- **DLQ (Dead Letter Queue)** — Jobs falhos com retry manual
- **Stats** — Métricas de sistema (filas, workers)
- **Presença** — Status online dos usuários

---

## 7. INTELIGÊNCIA ARTIFICIAL

### 7.1 — Score de Lead (sem LLM, custo zero)
- Algoritmo baseado em regras com pesos:
  - Frequência de mensagens
  - Tempo médio de resposta
  - Procedimentos de interesse (valor)
  - Histórico de conversão
- Output: 0-100 com label (Frio, Morno, Quente, Muito Quente)

### 7.2 — Janela de Ouro
- Análise estatística de padrões de resposta
- Identifica melhor dia da semana + faixa horária
- Base: número de conversões no padrão detectado
- Único no mercado brasileiro

### 7.3 — Radar de Retenção
- Ciclos biológicos por procedimento:
  - Botox: retorno 120 dias
  - Preenchimento Labial: retorno 270 dias
  - Harmonização Facial: retorno 180 dias
  - Bioestimuladores: retorno 180 dias
  - Skinbooster: retorno 90 dias
  - Peeling/Microagulhamento: retorno 90 dias
- Alerta quando paciente ultrapassa o ciclo
- Score de risco de churn (0-100)
- Cron diário: `0 8 * * *`

### 7.4 — Concierge RAG
- Base de conhecimento treinada nos protocolos da clínica
- Busca vetorial (pgvector) por similaridade semântica
- Geração de resposta contextualizada via OpenAI
- Sugestão de resposta para a recepcionista (não envia automático)

### 7.5 — Análise de Sentimento
- Classificação de sentimento por mensagem
- Resumo automático de conversas via IA

---

## 8. AUTOMAÇÕES E BOTS

### 8.1 — Automações (DAG)
**Triggers disponíveis:**
- `NEW_MESSAGE_RECEIVED` — Nova mensagem WhatsApp
- `LEAD_STAGE_CHANGED` — Lead mudou de estágio
- `LEAD_CREATED` — Novo lead criado
- `CONTACT_IDLE` — Contato sem interação por X dias
- `APPOINTMENT_BOOKED` — Agendamento realizado
- `APPOINTMENT_COMPLETED` — Sessão concluída

**Ações disponíveis:**
- Enviar mensagem WhatsApp
- Enviar template
- Mover lead de estágio
- Atribuir responsável
- Criar tarefa
- Aguardar X tempo
- Condição (if/else)

### 8.2 — Construtor Visual de Bots
- Canvas React Flow (drag & drop de nós)
- Tipos de nós: mensagem, pergunta, condição, ação, delay
- Conexões com arestas direcionais
- Preview em tempo real
- Sessões de bot por lead (estado persistente)
- Ativação/desativação por bot

### 8.3 — Workers BullMQ (7 workers)
```
process-webhook.ts       — Processa webhooks da Evolution API
calculate-ai-score.ts    — Calcula score de IA do lead
golden-window.ts         — Calcula melhor hora de contato
retention-radar.ts       — Detecta risco de churn
execute-automation.ts    — Executa DAGs de automação
automation-scheduler.ts  — Triggers baseados em cron
reconcile-messages.ts    — Sincroniza mensagens perdidas
```

### 8.4 — Filas
```
inbox       — Processamento de mensagens recebidas
automation  — Execução de automações
ai          — Cálculos de IA (score, sentimento)
scheduler   — Tarefas agendadas
dlq         — Dead Letter Queue (jobs falhos)
```

---

## 9. INTEGRAÇÕES EXTERNAS

### 9.1 — WhatsApp (Evolution API v2)
- Container Docker isolado
- Envio/recebimento de mensagens em tempo real
- Suporte a: texto, imagem, áudio, vídeo, documento
- Templates pré-aprovados
- Marcação como lida
- Webhook para mensagens recebidas
- Diagnóstico de conexão
- Reconexão automática

### 9.2 — Pagamentos (Mercado Pago)
- PIX instantâneo
- Cartão de crédito/débito
- Boleto bancário
- Webhook de confirmação
- Checkout transparente

### 9.3 — Email (Resend)
- Templates HTML inline luxuosos
- Tipos de email:
  - Verificação de conta
  - Pós-sessão (com medidas e cuidados)
  - Convite para equipe CRM
- Suporte a domínio verificado e fallback

### 9.4 — IA (OpenAI)
- Embeddings: `text-embedding-3-small` (1536 dim)
- Chat: `gpt-4o-mini` (Concierge RAG)
- Fallback: Google Generative AI (Gemini)

### 9.5 — Imagens (Cloudinary)
- Upload e otimização automática
- Transformações (resize, crop)
- CDN global

### 9.6 — Mapas (Leaflet + OpenStreetMap)
- GPS em tempo real para atendimentos a domicílio
- Stream SSE de posição
- Geocodificação de endereço

### 9.7 — CEP (ViaCEP)
- Busca automática de endereço por CEP

### 9.8 — Login Social
- Google OAuth 2.0
- Instagram OAuth

---

## 10. SISTEMA DE AUTENTICAÇÃO

### Métodos de Login
1. **Email/Senha** — JWT com expiração de 7 dias
2. **Google OAuth** — Login social
3. **Instagram OAuth** — Login social
4. **WebAuthn/Passkeys** — Login biométrico (fingerprint, Face ID)
5. **Verificação de email** — Token de confirmação

### Modelo de Autorização
```
ADMIN   → Acesso total ao painel + CRM
PATIENT → Acesso ao portal do paciente
```

### CRM — Roles da Equipe
```
owner   → Proprietário do tenant
admin   → Administrador com acesso total
manager → Gerente com acesso a relatórios
agent   → Agente com acesso limitado
```

### Fluxo de Convite
1. Admin adiciona membro → POST cria CrmTeamMember
2. Se email não existe no sistema → gera `inviteToken` + envia email
3. Membro clica no link `/convite/[token]`
4. Cria senha → cria User (role ADMIN) + vincula ao CrmTeamMember
5. Token expira em 7 dias

---

## 11. TEMPO REAL (SSE + REDIS)

### Server-Sent Events
- **Endpoint:** `GET /api/crm/stream`
- **Canal:** Redis pub/sub
- **Heartbeat:** 30 segundos
- **Eventos:**
  - `lead:updated` — Lead alterado
  - `lead:moved` — Lead mudou de estágio
  - `message:new` — Nova mensagem WhatsApp
  - `conversation:updated` — Conversa atualizada
  - `notification:new` — Nova notificação

### Presença de Usuários
- Status online/offline via Redis
- Último acesso com timestamp
- Usado no inbox para distribuição de conversas

### GPS Tracking (Legacy)
- Stream SSE de posição do profissional
- Mapa Leaflet em tempo real
- Para atendimentos a domicílio

---

## 12. WORKERS E FILAS (BULLMQ)

### Configuração
```
5 filas:
  inbox       — 3 tentativas, backoff exponencial
  automation  — 3 tentativas, backoff exponencial
  ai          — 2 tentativas, backoff exponencial
  scheduler   — sem retry
  dlq         — 1 tentativa (dead letter)
```

### DLQ (Dead Letter Queue)
- Jobs que falharam todas as tentativas
- Interface admin em `/admin/crm/system/dlq`
- Botão "Reenfileirar" por job
- Detalhes do erro e payload original

### Processo Separado
```bash
npx tsx workers/crm/index.ts
```
- Roda independente do Next.js
- Conecta ao mesmo Redis e PostgreSQL
- 4 workers paralelos (inbox, automation, ai, scheduler)

---

## 13. DESIGN SYSTEM

### Paleta de Cores (Dark Mode Obrigatório)
```css
--crm-bg:          #0A0A0B    /* Fundo principal */
--crm-surface:     #111114    /* Cards e painéis */
--crm-surface-2:   #1A1A1F    /* Hover e elevação */
--crm-border:      #2A2A32    /* Bordas */
--crm-gold:        #D4AF37    /* Acento premium/dourado */
--crm-gold-subtle: rgba(212,175,55,0.12)
--crm-text:        #F0EDE8    /* Branco quente */
--crm-text-muted:  #8B8A94    /* Cinza suave */
--crm-hot:         #FF6B4A    /* Lead quente */
--crm-warm:        #F0A500    /* Lead morno */
--crm-cold:        #4A7BFF    /* Lead frio */
--crm-won:         #2ECC8A    /* Lead ganho */
```

### Paleta Legacy (Clínica)
```css
Primária:    #b76e79 (rosé)
Gradiente:   #b76e79 → #c28a93 → #d4a0a7
Background:  #0e0b10 (escuro)
```

### Tipografia
- **Títulos:** Cormorant Garamond (serif, luxo)
- **Interface:** DM Sans (sans-serif, clean)

### Componentes
- **Cards:** border-radius 12px
- **Inputs:** border-radius 8px
- **Badges:** border-radius 6px
- **Sombras repouso:** `0 4px 24px rgba(0,0,0,0.4)`
- **Sombras hover:** `0 25px 50px rgba(0,0,0,0.45)`
- **Glassmorphism:** `backdrop-filter: blur(20px)` + `bg-white/5`

### Animações
- **Física de mola:** `stiffness: 400, damping: 25, mass: 1.2`
- **Drag:** Card inclina 1.5°, vizinhos desfocam (blur 1.5px, opacity 0.4)
- **Carregamento:** Esqueleto animado (nunca spinner genérico)
- **Estado vazio:** Ilustração contextual
- **Micro-feedback:** Sons (12% volume) + Vibration API

### Referências Visuais
Linear, Vercel Dashboard, Stripe, Raycast, Loom

---

## 14. TODAS AS PÁGINAS

### Site Público (5 páginas)
| Rota | Descrição |
|---|---|
| `/` | Landing page com seções dinâmicas |
| `/galeria-resultados` | Galeria de resultados (antes/depois) |
| `/proposta/[token]` | Proposta pública (visualização) |
| `/convite/[token]` | Aceitar convite da equipe CRM |
| `/check-in/[id]` | Check-in de agendamento |

### Portal do Paciente (8 páginas)
| Rota | Descrição |
|---|---|
| `/cliente` | Dashboard do paciente |
| `/cliente/agendar` | Agendar sessão |
| `/cliente/meus-agendamentos` | Meus agendamentos |
| `/cliente/evolucao` | Evolução corporal (gráficos) |
| `/cliente/pacotes` | Meus pacotes |
| `/cliente/fidelidade` | Programa de pontos |
| `/cliente/indicar` | Indicar amigas |
| `/cliente/perfil` | Meu perfil |

### Painel Admin — Clínica (20 páginas)
| Rota | Descrição |
|---|---|
| `/admin` | Dashboard principal |
| `/admin/agenda` | Calendário de agendamentos |
| `/admin/servicos` | Catálogo de serviços |
| `/admin/clientes` | Lista de pacientes |
| `/admin/clientes/[id]` | Ficha do paciente |
| `/admin/relatorios` | Relatórios gerais |
| `/admin/comissoes` | Comissões por profissional |
| `/admin/lista-espera` | Lista de espera |
| `/admin/gift-cards` | Gift cards |
| `/admin/protocolos` | Protocolos de tratamento |
| `/admin/importar-clientes` | Importação em massa |
| `/admin/mensagens` | Broadcast de mensagens |
| `/admin/indicacoes` | Programa de indicações |
| `/admin/financeiro` | Contas a receber |
| `/admin/pro-labore` | Gestão de salários |
| `/admin/estoque` | Controle de estoque |
| `/admin/fidelidade` | Programa de fidelidade |
| `/admin/configuracoes` | Configurações gerais |
| `/admin/configuracoes/site` | Editar conteúdo do site |
| `/admin/galeria` | Gerenciar galeria |
| `/admin/rastreamento` | GPS em tempo real |

### Painel Admin — CRM Luna (32 páginas)
| Rota | Descrição |
|---|---|
| `/admin/crm` | Hub do CRM |
| `/admin/crm/dashboard` | Dashboard CRM com KPIs |
| `/admin/crm/pipeline` | Kanban (drag & drop) |
| `/admin/crm/leads/[id]` | Detalhe do lead |
| `/admin/crm/inbox` | Caixa de entrada WhatsApp |
| `/admin/crm/contacts` | Diretório de contatos |
| `/admin/crm/intelligence` | IA + Janela de Ouro |
| `/admin/crm/knowledge` | Base de conhecimento RAG |
| `/admin/crm/automations` | Regras de automação |
| `/admin/crm/automations/bots` | Construtor visual de bots |
| `/admin/crm/broadcast` | Campanhas em massa |
| `/admin/crm/proposals` | Propostas/orçamentos |
| `/admin/crm/templates` | Templates de mensagem |
| `/admin/crm/team` | Gestão de equipe |
| `/admin/crm/integrations` | Integrações (WhatsApp) |
| `/admin/crm/webhooks` | Webhooks (entrada/saída) |
| `/admin/crm/reports` | Hub de relatórios |
| `/admin/crm/reports/overview` | Relatório geral |
| `/admin/crm/reports/consolidated` | Funil consolidado |
| `/admin/crm/reports/activities` | Log de atividades |
| `/admin/crm/reports/communications` | Analytics de mensagens |
| `/admin/crm/reports/roi` | ROI por fonte |
| `/admin/crm/reports/wins-losses` | Análise ganhos/perdas |
| `/admin/crm/reports/goals` | Metas vs realizado |
| `/admin/crm/settings` | Configurações do tenant |
| `/admin/crm/settings/ai-agent` | Configuração do agente IA |
| `/admin/crm/nps` | Pesquisas NPS |
| `/admin/crm/system/dlq` | Dead Letter Queue |

**Total: 65+ páginas**

---

## 15. TODAS AS APIS

### Autenticação (10 rotas)
```
POST /api/auth/login              — Login email/senha
POST /api/auth/register           — Cadastro
GET  /api/auth/verify-email       — Verificar email
POST /api/auth/resend-verification — Reenviar verificação
POST /api/auth/change-password    — Alterar senha
POST /api/auth/webauthn           — Login biométrico
GET  /api/auth/google/callback    — OAuth Google
GET  /api/auth/instagram/callback — OAuth Instagram
GET  /api/auth/link-email         — Vincular email
GET  /api/auth/link-phone         — Vincular telefone
```

### Paciente (10 rotas)
```
GET  /api/patient/profile         — Perfil do paciente
POST /api/patient/profile         — Atualizar perfil
GET  /api/patient/dashboard       — Dashboard
GET  /api/patient/appointments    — Agendamentos
POST /api/patient/measurements    — Salvar medidas
GET  /api/patient/packages        — Pacotes
GET  /api/patient/loyalty         — Pontos de fidelidade
GET  /api/patient/pending-reviews — Avaliações pendentes
POST /api/patient/anamnese        — Ficha de anamnese
GET  /api/patient/referral        — Código de indicação
```

### Agendamento (7 rotas)
```
GET  /api/booking/availability         — Horários disponíveis
POST /api/appointments                 — Agendar
GET  /api/admin/appointments           — Listar agendamentos
POST /api/admin/appointments/displacement — Deslocamento
GET  /api/admin/blocked-dates          — Datas bloqueadas
POST /api/admin/blocked-dates          — Bloquear data
```

### Pagamentos (5 rotas)
```
POST /api/payments/checkout   — Criar checkout Mercado Pago
GET  /api/payments/order      — Status do pedido
POST /api/payments            — Registrar pagamento manual
GET  /api/payments/success    — Confirmação de pagamento
POST /api/payments/webhook    — Webhook Mercado Pago
```

### CRM — Leads (8 rotas)
```
GET    /api/admin/crm/leads              — Listar leads
POST   /api/admin/crm/leads              — Criar lead
PUT    /api/admin/crm/leads/[id]         — Atualizar lead
DELETE /api/admin/crm/leads/[id]         — Excluir (lógico)
POST   /api/admin/crm/leads/import       — Importar leads
POST   /api/admin/crm/leads/move         — Mover entre estágios
POST   /api/admin/crm/leads/[id]/convert — Converter em paciente
GET    /api/admin/crm/leads/[id]/activity — Timeline do lead
```

### CRM — Pipeline (4 rotas)
```
GET  /api/admin/crm/pipeline  — Pipeline com estágios e leads
POST /api/admin/crm/pipeline  — Criar pipeline
GET  /api/admin/crm/stages    — Listar estágios
POST /api/admin/crm/stages    — Criar/atualizar estágio
```

### CRM — Conversas (5 rotas)
```
GET  /api/admin/crm/conversations          — Listar conversas
POST /api/admin/crm/conversations          — Criar conversa
POST /api/admin/crm/conversations/start    — Iniciar conversa
POST /api/admin/crm/conversations/messages — Enviar mensagem
GET  /api/admin/crm/conversations/summary  — Resumo IA
```

### CRM — Automações (6 rotas)
```
GET    /api/admin/crm/automations          — Listar automações
POST   /api/admin/crm/automations          — Criar automação
PUT    /api/admin/crm/automations/[id]     — Atualizar
DELETE /api/admin/crm/automations/[id]     — Excluir
POST   /api/admin/crm/automations/[id]/trigger — Disparar manual
GET    /api/admin/crm/automations/logs     — Logs de execução
```

### CRM — Bots (4 rotas)
```
GET    /api/admin/crm/bots      — Listar bots
POST   /api/admin/crm/bots      — Criar bot
PUT    /api/admin/crm/bots/[id] — Atualizar bot
DELETE /api/admin/crm/bots/[id] — Excluir bot
```

### CRM — IA (3 rotas)
```
POST /api/admin/crm/ai/score    — Calcular score do lead
POST /api/admin/crm/ai/insight  — Gerar insight IA
POST /api/admin/crm/concierge   — Sugestão de resposta (RAG)
```

### CRM — Knowledge Base (3 rotas)
```
GET  /api/admin/crm/knowledge            — Listar documentos
POST /api/admin/crm/knowledge/upload     — Upload PDF
POST /api/admin/crm/knowledge/reprocess  — Reprocessar embeddings
```

### CRM — Broadcasts (4 rotas)
```
GET    /api/admin/crm/broadcasts      — Listar campanhas
POST   /api/admin/crm/broadcasts      — Criar campanha
PUT    /api/admin/crm/broadcasts/[id] — Atualizar
DELETE /api/admin/crm/broadcasts/[id] — Excluir
```

### CRM — Propostas (4 rotas)
```
GET    /api/admin/crm/proposals      — Listar propostas
POST   /api/admin/crm/proposals      — Criar proposta
PUT    /api/admin/crm/proposals/[id] — Atualizar
DELETE /api/admin/crm/proposals/[id] — Excluir
```

### CRM — Templates (4 rotas)
```
GET    /api/admin/crm/templates      — Listar templates
POST   /api/admin/crm/templates      — Criar template
PUT    /api/admin/crm/templates/[id] — Atualizar
DELETE /api/admin/crm/templates/[id] — Excluir
```

### CRM — Equipe (6 rotas)
```
GET    /api/admin/crm/team          — Listar membros
POST   /api/admin/crm/team          — Adicionar + enviar convite
PUT    /api/admin/crm/team/[id]     — Atualizar membro
DELETE /api/admin/crm/team/[id]     — Desativar membro
POST   /api/admin/crm/team/assign   — Atribuir lead
GET    /api/admin/crm/team/stats    — Métricas da equipe
```

### CRM — Integrações (6 rotas)
```
GET  /api/admin/crm/integrations/status              — Status geral
POST /api/admin/crm/integrations/test                 — Testar conexão
POST /api/admin/crm/integrations/config               — Salvar config
GET  /api/admin/crm/integrations/whatsapp/status      — Status WhatsApp
POST /api/admin/crm/integrations/whatsapp/connect     — Conectar WhatsApp
POST /api/admin/crm/integrations/whatsapp/diagnose    — Diagnóstico
```

### CRM — Webhooks (8 rotas)
```
GET    /api/admin/crm/webhooks/incoming      — Listar webhooks entrada
POST   /api/admin/crm/webhooks/incoming      — Criar
PUT    /api/admin/crm/webhooks/incoming/[id] — Atualizar
DELETE /api/admin/crm/webhooks/incoming/[id] — Excluir
GET    /api/admin/crm/webhooks/outgoing      — Listar webhooks saída
POST   /api/admin/crm/webhooks/outgoing      — Criar
PUT    /api/admin/crm/webhooks/outgoing/[id] — Atualizar
DELETE /api/admin/crm/webhooks/outgoing/[id] — Excluir
GET    /api/admin/crm/webhooks/logs          — Logs
```

### CRM — Relatórios (7 rotas)
```
GET /api/admin/crm/reports/overview        — KPIs gerais
GET /api/admin/crm/reports/consolidated    — Funil + conversão
GET /api/admin/crm/reports/activities      — Log de atividades
GET /api/admin/crm/reports/communications  — Analytics mensagens
GET /api/admin/crm/reports/roi             — ROI por fonte
GET /api/admin/crm/reports/wins-losses     — Análise ganhos/perdas
GET /api/admin/crm/reports/goals           — Metas vs realizado
```

### CRM — NPS (2 rotas)
```
GET  /api/admin/crm/nps  — Configuração e respostas
POST /api/admin/crm/nps  — Salvar configuração
```

### CRM — Settings (4 rotas)
```
GET  /api/admin/crm/settings           — Configurações do tenant
POST /api/admin/crm/settings           — Salvar configurações
GET  /api/admin/crm/settings/ai-agent  — Config do agente IA
POST /api/admin/crm/settings/ai-agent  — Salvar config IA
```

### CRM — Sistema (4 rotas)
```
GET  /api/admin/crm/system/dlq        — Jobs falhos
POST /api/admin/crm/system/dlq/requeue — Reenfileirar job
GET  /api/admin/crm/system/stats      — Métricas de sistema
GET  /api/admin/crm/presence          — Status online
GET  /api/admin/crm/smart-replies     — Respostas inteligentes
```

### CRM — Tempo Real (1 rota)
```
GET /api/crm/stream  — SSE (Server-Sent Events)
```

### CRM — Convite (2 rotas)
```
GET  /api/crm/invite/accept  — Validar token de convite
POST /api/crm/invite/accept  — Aceitar convite + criar conta
```

### Públicas (12 rotas)
```
POST /api/webhooks/evolution           — Webhook Evolution API
GET  /api/health                       — Health check
GET  /api/address/cep                  — Busca por CEP
GET  /api/address/geocode              — Geocodificação
GET  /api/gallery                      — Galeria pública
POST /api/reviews                      — Enviar avaliação
GET  /api/reviews/summary              — Resumo de avaliações
GET  /api/services                     — Listar serviços
POST /api/chatbot                      — Chatbot do site
GET  /api/public/proposals/[token]     — Proposta pública
GET  /api/gps/position                 — Posição GPS
GET  /api/gps/stream                   — SSE GPS
```

### Admin Geral (20+ rotas)
```
GET  /api/admin/dashboard       — Dashboard KPIs
GET  /api/admin/clients         — Listar clientes
POST /api/admin/clients         — Criar cliente
PUT  /api/admin/clients/[id]    — Atualizar
POST /api/admin/clients/[id]/credits — Adicionar créditos
GET  /api/admin/schedule        — Grade horária
POST /api/admin/schedule        — Atualizar grade
GET  /api/admin/services        — Serviços
POST /api/admin/services        — Criar serviço
GET  /api/admin/finances        — Financeiro
GET  /api/admin/reports         — Relatórios
GET  /api/admin/inventory       — Estoque
GET  /api/admin/loyalty         — Fidelidade
GET  /api/admin/protocols       — Protocolos
GET  /api/admin/waitlist        — Lista de espera
GET  /api/admin/gallery         — Galeria
GET  /api/admin/gift-cards      — Gift cards
GET  /api/admin/measurements    — Medidas
GET  /api/admin/receipts        — Recibos
GET  /api/admin/settings        — Configurações
POST /api/admin/settings        — Salvar configurações
GET  /api/admin/share-contact   — Compartilhar contato
POST /api/admin/import-clients  — Importar clientes
```

**Total: 133+ rotas API**

---

## 16. COMPONENTES

### CRM (8 componentes)
```
crm/CrmToast.tsx              — Notificações toast
crm/reports/ReportsContext.tsx — Contexto de filtros
crm/reports/DateRangeFilter.tsx — Seletor de período
crm/reports/ReportMetricCard.tsx — Cards de KPI
crm/reports/ReportChartCard.tsx  — Wrapper de gráfico
crm/reports/ExportCSVButton.tsx  — Exportação CSV
crm/reports/ReportEmptyState.tsx — Estado vazio
crm/reports/ReportSkeleton.tsx   — Skeleton loading
```

### Dashboard (4 componentes)
```
dashboard/DashboardLayout.tsx     — Container
dashboard/AppointmentsList.tsx    — Lista de agendamentos
dashboard/SimpleBarChart.tsx      — Gráfico de barras
dashboard/StatCard.tsx            — Card de métrica
```

### Paciente (3 componentes)
```
patient/PatientLayout.tsx         — Layout do portal
patient/BeforeAfterSlider.tsx     — Slider antes/depois
patient/SessionFeedbackModal.tsx  — Modal de avaliação
```

### Site Público (15+ componentes)
```
HeroSection.tsx          — Hero da landing page
Header.tsx               — Navegação
Footer.tsx               — Rodapé
FloatingWhatsApp.tsx     — WhatsApp flutuante
FAQ.tsx                  — Perguntas frequentes
Testimoniais.tsx         — Depoimentos
ResultadosReais.tsx      — Galeria antes/depois
EquipeAmbiente.tsx       — Equipe e ambiente
ServicesSection.tsx      — Seção de serviços
ProfessionalsSection.tsx — Profissionais
TechnologiesSection.tsx  — Tecnologias
AppShowcase.tsx          — Showcase do app
AboutMykaele.tsx         — Sobre
AgendamentoSection.tsx   — CTA de agendamento
GaleriaDinamica.tsx      — Galeria dinâmica
GaleriaVideos.tsx        — Vídeos
```

### Utilitários (12+ componentes)
```
Skeleton.tsx            — Loading skeleton
PageTransition.tsx      — Transição de rota
PullToRefresh.tsx       — Pull to refresh (mobile)
UserAvatar.tsx          — Avatar do usuário
StarRatingInput.tsx     — Input de estrelas
SessionTicket.tsx       — Ticket 3D (Vitrine)
BiometricButton.tsx     — Botão biométrico
NotificationPrompt.tsx  — Solicitar notificações
PWAProvider.tsx         — Setup PWA
ClientProviders.tsx     — Providers do contexto
HomeAnimations.tsx      — Animações Lottie
MediaUploadManager.tsx  — Upload de mídia
```

---

## 17. HOOKS E STORES

### Hooks (8 hooks)
```typescript
useHaptic.ts            — Feedback vibratório (mobile)
useConfetti.ts          — Animação de confete (lead ganho)
useWebAuthn.ts          — Autenticação biométrica
useScrollAnimation.ts   — Animações no scroll
useNotifications.ts     — Toast notifications
useBodyScrollLock.ts    — Travar scroll (modais)
use-crm-stream.ts       — SSE subscription CRM
use-presence.ts          — Status online do usuário
```

### Stores Zustand (2 stores)
```typescript
crm-store.ts   — Estado do CRM (pipeline, leads, lead selecionado, filtros)
toast-store.ts — Fila de notificações toast
```

---

## 18. SERVER ACTIONS

```typescript
actions/crm/move-lead.ts              — Mover lead entre estágios (useOptimistic)
actions/crm/send-message.ts           — Enviar mensagem WhatsApp
actions/crm/mark-clinical-media.ts    — Marcar mídia como clínica
actions/crm/whatsapp-connection.ts    — Configurar conexão WhatsApp
```

---

## 19. SEGURANÇA E LGPD

### Criptografia
- **AES-256-GCM** para credenciais de integração (`src/lib/crypto.ts`)
- **bcryptjs** (salt 10) para senhas
- **JWT** com secret rotacionável

### LGPD (Lei Geral de Proteção de Dados)
- **Audit Log** — Toda ação sensível é logada (`src/lib/audit.ts`)
- **Anonimização** — `anonymizeLead()` substitui dados pessoais (Art. 18 LGPD)
- **Exclusão lógica** — Leads nunca são deletados, apenas `deletedAt`
- **Cofre de mídia** — Fotos clínicas com acesso auditado

### Headers de Segurança
- HSTS (2 anos, incluindo subdomínios)
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- CSP com whitelist de domínios
- Remoção de X-Powered-By e Server

### Rate Limiting
- Em memória, por rota
- Configurável por endpoint

---

## 20. INFRAESTRUTURA E DEPLOY

### Docker Compose (5 serviços)
```yaml
app:        Next.js (porta 3000)
db:         PostgreSQL 16 + pgvector (porta 5432)
redis:      Redis 7-alpine (porta 6379)
evolution:  Evolution API v2 (porta 8080)
crm-worker: Workers BullMQ (processo separado)
```

### Deploy
1. Claude edita código + commita
2. `git push` manual
3. Coolify detecta push → auto-deploy via Docker

### Build
- **Output:** `standalone` (imagem Docker mínima)
- **Turbopack:** Desabilitado (causa erro de source map)
- **Compression:** Habilitado

---

## 21. VARIÁVEIS DE AMBIENTE

```env
# === Banco de Dados ===
DATABASE_URL=postgresql://...
REDIS_URL=redis://redis:6379

# === Autenticação ===
JWT_SECRET=<secret>
GOOGLE_CLIENT_ID=<id>
GOOGLE_CLIENT_SECRET=<secret>
INSTAGRAM_CLIENT_ID=<id>
INSTAGRAM_CLIENT_SECRET=<secret>

# === Pagamentos ===
MERCADO_PAGO_ACCESS_TOKEN=<token>
MERCADO_PAGO_PUBLIC_KEY=<key>

# === Email ===
RESEND_API_KEY=<key>
RESEND_VERIFIED_DOMAIN=<domain>

# === WhatsApp ===
EVOLUTION_API_URL=http://evolution:8080
EVOLUTION_API_KEY=<key>
EVOLUTION_WEBHOOK_SECRET=<secret>

# === IA ===
OPENAI_API_KEY=<key>
GEMINI_API_KEY=<key>

# === Criptografia ===
ENCRYPTION_KEY=<32-byte hex>

# === Multi-tenancy ===
DEFAULT_TENANT_ID=clinica-mykaele-procopio

# === Imagens ===
CLOUDINARY_CLOUD_NAME=<name>
CLOUDINARY_API_KEY=<key>
CLOUDINARY_API_SECRET=<secret>

# === App ===
NEXT_PUBLIC_APP_URL=https://mykaprocopio.com.br
NODE_ENV=production

# === Radar de Retenção ===
RETENTION_RADAR_CRON="0 8 * * *"
RETENTION_RISK_THRESHOLD=70

# === S3 (opcional) ===
S3_ENABLED=false
S3_BUCKET=
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_ENDPOINT=
```

---

## 22. CRONOLOGIA DO PROJETO

### Fase 0 — Fundação
- Setup Next.js + Prisma + PostgreSQL
- Landing page com seções dinâmicas
- Sistema de autenticação (email/senha + social)
- CRUD de serviços e pacotes

### Fase 1 — Clínica Core
- Agendamento com grade horária
- Portal do paciente (self-service)
- Medidas corporais com evolução
- Pagamentos via Mercado Pago
- Programa de fidelidade
- Sistema de indicações
- Estoque e financeiro
- GPS em tempo real
- Gift cards e lista de espera

### Fase 2 — CRM Foundation
- Schema CRM (17 models iniciais)
- Pipeline Kanban com drag & drop
- Gestão de leads (CRUD + status)
- Índice fracionário para posicionamento

### Fase 3 — Messaging + IA
- Integração Evolution API v2
- Caixa de entrada WhatsApp
- Score de IA (algoritmo sem LLM)
- Janela de Ouro
- Radar de Retenção
- Base de conhecimento RAG

### Fase 4 — Automação + Bots
- Construtor visual React Flow
- Motor de automação (DAG)
- Workers BullMQ (7 workers)
- Templates de mensagem

### Fase 5 — Growth Tools
- Broadcast em massa
- Propostas/orçamentos com link público
- NPS (Net Promoter Score)
- Gestão de equipe com convites
- Webhooks (entrada/saída)
- 8 relatórios analíticos
- Dashboard CRM
- Metas e ROI
- Configuração de agente IA

### Fase 6 — Polish (Atual)
- Convite por email real (Resend)
- Página de criação de senha
- Melhorias de UX
- Correções de bugs mobile
- Otimização de performance

---

## 23. MÉTRICAS DO CODEBASE

| Métrica | Valor |
|---|---|
| **Models Prisma** | 47 (27 legacy + 20 CRM) |
| **Rotas API** | 133+ |
| **Páginas Admin** | 50+ |
| **Páginas CRM** | 32 |
| **Componentes UI** | 40+ |
| **Hooks** | 8 |
| **Stores** | 2 |
| **Server Actions** | 4 |
| **Workers** | 7 |
| **Filas BullMQ** | 5 |
| **Libs em src/lib/** | 20+ |
| **Integrações externas** | 8+ |
| **Métodos de autenticação** | 5 |
| **Tipos de relatório** | 8 |
| **Variáveis de ambiente** | 25+ |
| **Serviços Docker** | 5 |

---

## 24. VANTAGENS COMPETITIVAS VS KOMMO

| Feature | Kommo | Luna |
|---|---|---|
| **WhatsApp** | Via Twilio (genérico) | Evolution API nativa |
| **UI/UX** | Interface padrão SaaS | Design Apple-native, dark luxury |
| **Kanban** | Drag simples | Física real (inclinação, sombra, blur) |
| **Score de IA** | Pago (add-on) | Incluso, custo zero (sem LLM) |
| **Janela de Ouro** | Não existe | Análise estatística exclusiva |
| **Radar de Retenção** | Não existe | Ciclo biológico por procedimento |
| **Concierge RAG** | Bot genérico | IA treinada nos protocolos da clínica |
| **NPS** | Não existe | Pesquisa automática pós-atendimento |
| **Propostas** | Básico | Link público com tracking |
| **Bot Builder** | Fluxo básico | Canvas visual React Flow |
| **Cofre de Mídia** | Não existe | Fotos clínicas com auditoria LGPD |
| **Multi-tenant** | Sim | Sim (tenantId em tudo) |
| **Preço** | $15-79/user/mês | Incluído no SaaS da clínica |

### Funcionalidades Exclusivas do Luna
1. **Janela de Ouro** — Melhor dia/hora baseado em padrão estatístico
2. **Radar de Retenção** — Alerta por ciclo biológico do procedimento
3. **Concierge RAG** — IA conhece os protocolos reais da clínica
4. **Cofre de Mídia Clínica** — Fotos antes/depois com auditoria LGPD
5. **Física no Kanban** — Cards com peso, inclinação e sombra real
6. **Integração Clínica** — Lead vira paciente, agendamento vira lead

---

## 25. LIÇÕES OPERACIONAIS (Produção — 14/03/2026)

> Problemas reais encontrados em produção e suas soluções documentadas.

### 25.1 — WhatsApp LID (@lid)

O WhatsApp migrou alguns contatos do formato `@s.whatsapp.net` para **Linked ID** (`@lid`).

| Campo | Formato Antigo | Formato LID |
|---|---|---|
| remoteJid | `5585999999999@s.whatsapp.net` | `122715923083278@lid` |
| Phone | `5585999999999` | `122715923083278` (NÃO é telefone!) |

**Arquivos que tratam @lid:**
```
src/lib/evolution-api.ts         — normalizeNumber() mantém JID @lid intacto
app/api/crm/sync-messages/       — filtro + extração de phone
src/lib/webhook-processor.ts     — extração de phone
src/workers/crm/process-webhook.ts — extração de phone
```

**Padrão obrigatório em qualquer código novo:**
```typescript
const phone = remoteJid
  .replace('@s.whatsapp.net', '')
  .replace('@c.us', '')
  .replace('@lid', '')
```

### 25.2 — Evolution API: webhookByEvents

A Evolution API (v1.8.1) opera com `webhookByEvents: true`, enviando webhooks para sub-paths:

| Evento | URL chamada |
|---|---|
| messages.upsert | `/api/webhooks/evolution/messages-upsert` |
| connection.update | `/api/webhooks/evolution/connection-update` |
| qrcode.updated | `/api/webhooks/evolution/qrcode-updated` |

**Solução:** Rota catch-all `app/api/webhooks/evolution/[...slug]/route.ts`

**Middleware:** `/api/webhooks/evolution` está em `PUBLIC_PREFIXES` (não PUBLIC_PATHS).

**NUNCA** mover para PUBLIC_PATHS — quebraria webhooks com sub-path.

### 25.3 — Race Condition: Auto-Reply Duplicado

Webhook + polling simultâneo → ambos passam `alreadySentAutoReply()` → mensagem duplicada.

**Solução:** `markAutoReplySent()` chamado ANTES do delay/envio (lock otimista).

### 25.4 — Polling: Limites da Evolution API

| Parâmetro | Antes | Depois (otimizado) |
|---|---|---|
| Chats por ciclo | 20 | 5 |
| Timeout findMessages | 12s | 6s |
| Intervalo polling | 20s | 30s |

O polling é **FALLBACK**. O mecanismo principal são os **webhooks**.

### 25.5 — VPS: Espaço em Disco

Docker acumula imagens. Limpar periodicamente no terminal do Coolify:
```bash
docker system prune -a --volumes -f
```

### 25.6 — Gemini API Key (3 locais)

| Local | Onde | Usado por |
|---|---|---|
| Banco (CrmIntegration) | UI Configurações → IA | test-ai, ai-agent |
| Coolify env var | GEMINI_API_KEY | smart-replies, concierge |
| .env local | GEMINI_API_KEY | desenvolvimento |

**Após trocar a key:** atualizar nos 3 locais + redeploy obrigatório.

### 25.7 — Webhook Route Architecture

```
/api/webhooks/evolution/          ← handler principal (POST)
/api/webhooks/evolution/[...slug] ← catch-all para webhookByEvents (POST)
    ├── /messages-upsert          → processa via inline ou BullMQ
    ├── /connection-update        → ignora (não é HANDLED_EVENT com dados)
    └── /qrcode-updated           → ignora
```

Ambos os handlers usam a mesma lógica: validate → parse → enqueue/inline.

---

*BÍBLIA.md v1.1 — Março 2026*
*Documento gerado automaticamente a partir da auditoria completa do codebase*
*65+ páginas · 133+ APIs · 47 models · 8+ integrações*
*Seção 25 adicionada: Lições Operacionais de Produção (14/03/2026)*
