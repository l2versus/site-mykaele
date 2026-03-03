<div align="center">

# 🏛️ AestheticsPro — Plataforma Completa para Clínicas de Estética

### Sistema White-Label de Gestão, Agendamento e Relacionamento com Clientes

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?style=for-the-badge&logo=prisma)](https://www.prisma.io/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![PWA](https://img.shields.io/badge/PWA-Instalável-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white)](#-pwa--experiência-mobile)

**Plataforma SaaS completa e pronta para deploy** — projetada para clínicas de estética, spas, profissionais de saúde e beleza. Totalmente customizável como solução white-label.

[Funcionalidades](#-funcionalidades) · [Tech Stack](#-tech-stack) · [Arquitetura](#-arquitetura) · [Deploy](#-deploy) · [White-Label](#-personalização-white-label) · [Contato](#-contato-comercial)

</div>

---

## 📊 Números da Plataforma

| Métrica | Valor |
|:---|:---:|
| Endpoints de API | **54** |
| Páginas Completas | **31** |
| Modelos de Dados | **21** |
| Componentes React | **35+** |
| Integrações Externas | **13** |
| Datas Comemorativas para Marketing | **50+** |

---

## ✨ Funcionalidades

### 🌐 Landing Page Profissional

Uma landing page completa, otimizada para conversão e SEO, com seções dinâmicas:

- **Hero Section** com call-to-action de agendamento
- **Catálogo de Serviços** visual com preços
- **Galeria Antes/Depois** com slider interativo (arraste para revelar a transformação)
- **Showcase do Aplicativo PWA** com carrossel de vídeos
- **Depoimentos** de clientes
- **Equipe & Ambiente** — fotos do espaço e profissionais
- **Galeria de Vídeos** de procedimentos
- **Tecnologias & Equipamentos** utilizados
- **FAQ** com Schema.org `FAQPage` para SEO
- **Navegação flutuante** entre seções (SectionNav)

### 👤 Área do Cliente — 12 Páginas

| Funcionalidade | Descrição |
|:---|:---|
| **Dashboard Inteligente** | KPIs pessoais (sessões, investimento, saldo), próximo agendamento, protocolo ativo com ring de progresso, gráfico de atividade mensal, métricas corporais, status da anamnese |
| **Agendamento Online** | Wizard de 7 etapas: Serviço → Tipo → Local (Clínica/Home) → Data → Horário → Créditos → Confirmação |
| **Agendamento de Pacotes** | Agendamento múltiplo de todas as sessões do pacote de uma só vez (até 60 dias) |
| **Meus Agendamentos** | Lista com futuros e histórico, cancelamento com confirmação |
| **Pacotes** | Pacotes ativos com ring de progresso e fases (Início → Ativação → Remodelação → Refinamento → Manutenção) |
| **Carrinho de Compras** | Checkout integrado com Mercado Pago |
| **Créditos & Pacotes** | Compra de créditos avulsos com economia calculada |
| **Pagamentos** | Histórico financeiro com filtros e totais |
| **Evolução Corporal** | Gráficos de evolução temporal, medidas antropométricas (10+ partes do corpo), metas vs. progresso, **geração de relatório PDF** |
| **Anamnese Digital** | Ficha clínica completa: dados pessoais, 12 condições de saúde, estilo de vida, metas, consentimento |
| **Programa VIP/Fidelidade** | Sistema de pontos, tiers (Bronze → Diamante), ranking, código de indicação pessoal, resgate de recompensas |
| **Perfil** | Edição de dados, upload de avatar (Cloudinary), configurações de notificação WhatsApp, privacidade |

### 🔧 Painel Administrativo — 18 Páginas

| Funcionalidade | Descrição |
|:---|:---|
| **Dashboard Analítico** | KPIs animados: receita, lucro, ticket médio, LTV, MRR, taxa de ocupação, no-show, conversão. Agendamentos do dia, mix de serviços, alertas de estoque, **datas comemorativas com dicas de marketing** |
| **Agenda** | Calendário com timeline por dia, gestão de atendimentos, configuração de horários por dia da semana + intervalos + pausas, abertura de WhatsApp direto para cada paciente |
| **CRM de Clientes** | Lista com busca, ficha detalhada completa, histórico de agendamentos, pacotes, medidas corporais (antropometria), créditos, agendamento direto |
| **Serviços** | CRUD completo: nome, preço, preço retorno, duração, addon, taxa de deslocamento. Pacotes vinculados com sessões e preço |
| **Relatórios** | Receita por serviço (bar chart), receita mensal vs. despesas, heatmap de horários, novos clientes, métodos de pagamento, taxa de retenção |
| **Comissões** | Cálculo automático: receita bruta, taxa de cartão (configurável), imposto, líquido, split profissional/clínica |
| **Lista de Espera** | Gestão de fila: adicionar, notificar, agendar, cancelar. Filtros por status |
| **Gift Cards** | Criação com valor, destinatário, mensagem e validade. Validação e uso de saldo |
| **Protocolos de Tratamento** | Protocolos com etapas sequenciais: título, descrição, produtos por etapa, intervalo entre sessões |
| **Importação em Massa** | Planilha editável para importação: nome, email, telefone, CPF, pacote, sessões. Geração automática de senhas |
| **Broadcast WhatsApp** | Envio em massa: seleção de clientes, templates pré-prontos (Promoção, Agendamento, Novidade, Data Especial), variáveis personalizáveis `{nome}` |
| **Indicações** | Painel completo: ranking de indicadores, indicações pendentes/confirmadas, códigos ativos, tiers de desconto progressivo |
| **Financeiro** | Receitas e despesas com categorias (Material, Deslocamento, Aluguel, Marketing, Equipamento). Gráfico donut por categoria |
| **Pró-labore** | Plano de negócios configurável: pró-labore, alíquota de imposto, reserva de emergência, capitalização, ponto de equilíbrio, margem operacional, score financeiro |
| **Estoque** | CRUD de insumos (Material, Descartável, Cosmético, Equipamento), estoque mínimo, custo, fornecedor. Movimentações (entrada/saída/ajuste). Alertas de estoque baixo |
| **Fidelidade** | Gestão do programa: membros por tier, criar/editar recompensas (Desconto, Sessão Grátis, Adicional, Presente, Upgrade) |
| **Configurações** | Horários por dia da semana (início, fim, pausa, duração do slot), datas bloqueadas com motivo |
| **Gestão de Mídia** | Gerenciador visual: profissionais, procedimentos, antes/depois, tecnologias, certificados, vídeos. Upload via Cloudinary |

---

## 🤖 Chatbot IA Integrado

Assistente virtual inteligente com interface premium flutuante e draggable:

- **NLP Local** — Detecção de 13 intents por padrões (saudação, agendamento, preços, serviços, pacotes, localização, horários, pagamento, cuidados pós-sessão, etc.)
- **Knowledge Base** completa embutida (serviços, preços, endereço, horários, diferenciais)
- **Consulta ao banco** em tempo real para preços e disponibilidade
- **Fluxo por botões** interativo
- **Rate limiting** por IP
- **Fallback para n8n** como upgrade opcional
- **UI Premium** — tema escuro/rosé, arrastável, responsivo

---

## 🏆 Programa de Fidelidade & Indicações

```
Bronze → Prata → Ouro → Diamante
```

- **Sistema de pontos** — Ganhos por sessão, indicação, avaliação, aniversário, bônus por tier
- **4 Tiers** com progressão automática
- **Ranking** de clientes com posições
- **Recompensas** resgatáveis: Desconto, Sessão Grátis, Adicional, Presente, Upgrade
- **Código de indicação** pessoal (ex: `MARCA-ANA2024`)
- **Link de indicação** via `/ref/[code]` → redirect com pré-preenchimento
- **Desconto progressivo** por indicações confirmadas (tiers configuráveis)

---

## 🔗 Integrações

| Integração | Detalhes |
|:---|:---|
| **💳 Mercado Pago** | Checkout transparente, webhook HMAC SHA-256 com anti-replay, parcelas até 12x, PIX |
| **💬 WhatsApp** | 3 métodos: Evolution API (self-hosted), CallMeBot (gratuito), fallback console. Notificações de agendamento, confirmação, compra. Broadcast em massa |
| **☁️ Cloudinary** | Upload de fotos de perfil, mídia do site, transformações otimizadas |
| **🔐 Google OAuth** | Login social via Google |
| **📸 Instagram OAuth** | Login social via Instagram |
| **🆔 WebAuthn / Passkeys** | Login biométrico: Face ID, Touch ID, Windows Hello |
| **📧 Resend** | Emails transacionais pós-sessão e confirmação |
| **📊 Google Analytics 4** | Tracking de pageviews e eventos |
| **📱 Meta Pixel** | Tracking de conversões Facebook/Instagram Ads |
| **🔄 n8n (Opcional)** | Webhook para chatbot avançado e automações |
| **📍 ViaCEP + Geocoding** | Busca automática de endereço + cálculo de distância para taxa de deslocamento |

---

## 📱 PWA & Experiência Mobile

Aplicação PWA completa, instalável em qualquer dispositivo:

- **Service Worker** com caching offline-first (stale-while-revalidate + network-first com timeout)
- **Manifest** completo com atalhos nativos (Agendar, Meus Agendamentos)
- **Página offline** dedicada com branding
- **Banner de instalação** inteligente (Android + iOS + Desktop)
- **Pull-to-Refresh** nativo com efeito rubber-band
- **Feedback háptico** (Vibration API — 6 padrões: light, medium, heavy, success, error, selection)
- **Push Notifications** via Service Worker com prompt elegante
- **Apple Mobile Web App** ready (meta tags + standalone)

---

## 🔍 SEO & Marketing

- **JSON-LD** Structured Data: `HealthAndBeautyBusiness` + `FAQPage`
- **Open Graph** completo para Facebook/WhatsApp
- **Twitter Cards** (summary_large_image)
- **Sitemap dinâmico** gerado via Next.js com serviços do banco
- **Robots.txt** otimizado
- **Canonical URLs** configuradas
- **Meta Pixel** Facebook/Instagram Ads
- **Google Analytics 4** integrado
- **50+ datas comemorativas** brasileiras com dicas de marketing automáticas

---

## 🛡️ Segurança

| Camada | Implementação |
|:---|:---|
| **Transport** | HTTPS forçado (301), HSTS 2 anos com Preload |
| **Headers** | CSP restritiva, X-Frame-Options DENY, X-Content-Type-Options nosniff, X-XSS-Protection |
| **Políticas** | Referrer-Policy strict-origin, Permissions-Policy (câmera/mic desabilitados), COOP/CORP same-origin |
| **Autenticação** | JWT com expiração, bcrypt salt round 10, WebAuthn/Passkeys |
| **Pagamentos** | Webhook HMAC SHA-256, proteção anti-replay (5 min) |
| **Rate Limiting** | In-memory por IP no chatbot e APIs sensíveis |
| **Autorização** | Roles PATIENT/ADMIN com middleware protegido |

---

## 🛠️ Tech Stack

| Camada | Tecnologia |
|:---|:---|
| **Framework** | Next.js 16 (App Router, Server Components, Dynamic Imports) |
| **Linguagem** | TypeScript 5 |
| **UI** | React 19 + Tailwind CSS 4 |
| **Banco de Dados** | SQLite (dev) / PostgreSQL 16 (produção) |
| **ORM** | Prisma 7 (multi-adapter: SQLite + LibSQL + PostgreSQL) |
| **Autenticação** | JWT + bcryptjs + WebAuthn (@simplewebauthn) |
| **Pagamentos** | Mercado Pago SDK v2 |
| **Gráficos** | Recharts 3 |
| **Validação** | Zod 4 |
| **Emails** | Resend |
| **CDN de Imagens** | Cloudinary |
| **PDF** | jsPDF + html2canvas |
| **Datas** | date-fns |
| **HTTP** | Axios |
| **Cron Jobs** | node-cron |
| **Deploy** | Docker multi-stage + docker-compose |

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND (Next.js 16)                  │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │  Landing  │  │ Área Cliente │  │   Painel Admin (18p)   │ │
│  │   Page    │  │   (12 pgs)   │  │  Dashboard · CRM · Fin │ │
│  └──────────┘  └──────────────┘  └────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                    API ROUTES (54 endpoints)                 │
│  Auth(7) · Patient(8) · Admin(17) · Public(7) · Payments    │
├─────────────────────────────────────────────────────────────┤
│                     INTEGRAÇÕES EXTERNAS                    │
│  Mercado Pago · WhatsApp · Cloudinary · Google · WebAuthn   │
│  Resend · GA4 · Meta Pixel · ViaCEP · n8n                  │
├─────────────────────────────────────────────────────────────┤
│                   BANCO DE DADOS (21 modelos)               │
│              Prisma 7 → SQLite (dev) / PostgreSQL (prod)    │
├─────────────────────────────────────────────────────────────┤
│                      INFRAESTRUTURA                         │
│     Docker Multi-Stage · docker-compose · Coolify-Ready     │
└─────────────────────────────────────────────────────────────┘
```

### Modelos do Banco de Dados (21)

```
User · Service · PackageOption · Package · Appointment · Schedule
BlockedDate · Payment · Expense · BodyMeasurement · SessionFeedback
CareGuideline · Anamnese · ReferralCode · Referral · LoyaltyPoints
LoyaltyTransaction · LoyaltyReward · InventoryItem · StockMovement
Waitlist · GiftCard · TreatmentProtocol · DigitalReceipt
```

---

## 🚀 Deploy

### Docker (Recomendado)

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/aesthetics-pro.git
cd aesthetics-pro

# Configure as variáveis de ambiente
cp .env.example .env

# Suba com Docker Compose
docker-compose up -d
```

### Coolify (Self-Hosted PaaS)

1. No painel Coolify, crie um novo recurso apontando para o repositório GitHub
2. Coolify detectará automaticamente o `Dockerfile` e `docker-compose.yml`
3. Configure as variáveis de ambiente no painel
4. Deploy automático a cada push na branch `main`

### Variáveis de Ambiente

```env
# Banco de Dados
DATABASE_URL=postgresql://user:password@db:5432/aesthetics

# Autenticação
JWT_SECRET=sua-chave-secreta-jwt

# Mercado Pago
MERCADOPAGO_ACCESS_TOKEN=seu-token
MERCADOPAGO_PUBLIC_KEY=sua-chave-publica
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=sua-chave-publica

# WhatsApp
WHATSAPP_API_URL=https://sua-evolution-api.com
WHATSAPP_API_KEY=sua-chave
WHATSAPP_INSTANCE=sua-instancia

# Cloudinary
CLOUDINARY_CLOUD_NAME=seu-cloud
CLOUDINARY_API_KEY=sua-chave
CLOUDINARY_API_SECRET=seu-secret

# Email
RESEND_API_KEY=sua-chave-resend

# Google OAuth
GOOGLE_CLIENT_ID=seu-client-id
GOOGLE_CLIENT_SECRET=seu-secret

# Analytics
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
NEXT_PUBLIC_META_PIXEL_ID=seu-pixel-id

# Aplicação
NEXT_PUBLIC_BASE_URL=https://seu-dominio.com
```

---

## 🎨 Personalização White-Label

A plataforma foi projetada para fácil customização como produto white-label:

| Elemento | Como Personalizar |
|:---|:---|
| **Cores & Tema** | Variáveis CSS em `globals.css` — paleta de cores, gradientes, sombras |
| **Logo & Branding** | Substituir assets em `public/media/logo-branding/` |
| **Nome do Negócio** | Configurável via variáveis de ambiente e knowledge base do chatbot |
| **Serviços & Preços** | 100% gerenciável pelo painel admin (sem código) |
| **Textos & Copy** | Componentes editáveis com textos parametrizados |
| **Integrações** | Variáveis de ambiente para conectar Mercado Pago, WhatsApp, Cloudinary, etc. |
| **Domínio** | Deploy em qualquer domínio com Docker/Coolify |
| **Idioma** | Estrutura preparada para internacionalização (atualmente PT-BR) |

### Pontos de Customização Rápida

```
globals.css          → Cores, fontes, tema visual
layout.tsx           → Metadata, SEO, Open Graph
page.tsx (landing)   → Seções da landing page
chatbot/route.ts     → Knowledge base do chatbot IA
manifest.json        → Nome do app PWA, ícones, atalhos
public/media/        → Todas as mídias do site
```

---

## 📂 Estrutura do Projeto

```
├── app/
│   ├── page.tsx                  # Landing page
│   ├── layout.tsx                # Layout raiz + SEO
│   ├── globals.css               # Tema e estilos globais
│   ├── admin/                    # Painel administrativo (18 páginas)
│   ├── cliente/                  # Área do cliente (12 páginas)
│   ├── api/                      # 54 endpoints REST
│   ├── galeria-resultados/       # Galeria pública antes/depois
│   └── ref/[code]/               # Links de indicação
├── src/
│   ├── components/               # 35+ componentes React
│   ├── hooks/                    # Custom hooks (PWA, haptic, confetti...)
│   ├── lib/                      # Prisma client, auth, utils
│   └── data/                     # Dados estáticos
├── prisma/
│   └── schema.prisma             # 21 modelos de dados
├── public/
│   ├── manifest.json             # PWA manifest
│   ├── sw.js                     # Service Worker
│   └── media/                    # Mídias organizadas por categoria
├── Dockerfile                    # Build multi-stage otimizado
├── docker-compose.yml            # PostgreSQL + App
└── middleware.ts                  # Segurança (HTTPS, headers, HSTS)
```

---

## 🧰 Utilitários Extras

| Utilitário | Descrição |
|:---|:---|
| **PDF de Evolução** | Relatório PDF brandado com gráficos de medidas corporais |
| **PDF de Recibo** | Comprovante de pagamento com logo e status |
| **Calculadora de Deslocamento** | Taxa automática por distância (5 faixas configuráveis) |
| **Calculadora de Comissão** | Split profissional/clínica com taxas de cartão e imposto |
| **Animações de Scroll** | Reveal, parallax, counter animation (Intersection Observer) |
| **Confetti** | Efeito de celebração para conquistas e conversões |
| **Skeleton Loaders** | Loading states premium (KPI, Card, Appointment, Box) |
| **Page Transitions** | Transições suaves entre páginas |
| **Sistema de Referral Links** | `/ref/[code]` → redirect com código pré-preenchido |

---

## 📋 Desenvolvimento Local

```bash
# Instalar dependências
npm install

# Gerar Prisma Client (SQLite para dev)
npx prisma generate

# Rodar migrations
npx prisma db push

# Popular banco com dados de teste
node prisma/seed-completo.mjs

# Iniciar servidor de desenvolvimento
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000)

---

## 📄 Licença

Software proprietário. Todos os direitos reservados.  
Para licenciamento white-label, entre em contato.

---

<div align="center">

### 💼 Contato Comercial

**Interessado na solução white-label?**

Plataforma completa, pronta para deploy, com todas as funcionalidades de gestão, agendamento, pagamentos e relacionamento com clientes para o mercado de estética e saúde.

📧 Entre em contato para uma demonstração

---

*Desenvolvido com Next.js 16 · React 19 · TypeScript 5 · Prisma 7 · Tailwind CSS 4*

</div>
