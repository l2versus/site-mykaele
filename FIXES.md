# FIXES.md — Correções Urgentes

> **Data:** 12/03/2026
> **Prioridade:** Do mais urgente ao menos urgente

---

## BUG 1 — Pipeline Mobile: Cards cobrem botões de ação

**Severidade:** 🔴 Alta (impede uso no celular)
**Local:** `app/admin/crm/pipeline/page.tsx`

**Problema:**
- Em telas < 640px, os cards do Kanban ficam muito largos e o scroll horizontal não funciona bem
- Os botões "Importar" e "+ Lead" ficam apertados no header
- As colunas têm `w-[300px]` fixo que pode causar overflow

**Correção:**
```
Linha 551: Reduzir largura mínima das colunas em mobile
  De: className="shrink-0 w-[300px] md:w-[320px] ..."
  Para: className="shrink-0 w-[260px] sm:w-[300px] md:w-[320px] ..."

Linha 1261: Header precisa de flex-wrap em mobile
  De: className="flex items-center justify-between gap-3 px-3 lg:px-5 py-2"
  Para: className="flex items-center justify-between gap-2 px-2 sm:px-3 lg:px-5 py-2"

Linha 1269: Botões precisam de scroll horizontal
  De: className="flex items-center gap-2 shrink-0"
  Para: className="flex items-center gap-1.5 sm:gap-2 shrink-0"

Linha 1298: Stats cards grid
  De: className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5"
  Verificar se os cards não transbordam em telas de 320px

Linha 1306: Filtros precisam scroll em mobile
  De: className="flex flex-wrap items-center gap-2 mb-5"
  Para: className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-5"

Linha 1351: Kanban scroll horizontal
  De: className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 lg:-mx-6 lg:px-6 scrollbar-none"
  Para: className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 -mx-4 px-4 lg:-mx-6 lg:px-6 scrollbar-none snap-x snap-mandatory"

Cada coluna: adicionar snap-start para scroll suave entre colunas
```

**Teste:** Abrir em Chrome DevTools > iPhone SE (320px) e iPhone 12 (390px)

---

## BUG 2 — Intelligence page mostra dados vazios sem workers

**Severidade:** 🟡 Média (confunde o admin)
**Local:** `app/admin/crm/intelligence/page.tsx`

**Problema:**
- Sem Redis/workers rodando, todos os campos `aiScore`, `churnRisk`, `bestContactDays` são `null`
- A página mostra gráficos vazios sem explicar o porquê
- O heatmap fica vazio

**Correção:**
- Adicionar banner informativo quando não há dados de IA: "Os scores de IA serão calculados automaticamente quando os workers estiverem ativos. Configure Redis para ativar."
- Mostrar estado vazio com ação ("Configurar Redis" → link para docs)

---

## BUG 3 — Automations execution log simulado

**Severidade:** 🟢 Baixa (não afeta funcionalidade)
**Local:** `app/admin/crm/automations/page.tsx`

**Problema:**
- O log de execução é derivado do `flowJson` com timestamps simulados
- Não reflete execuções reais

**Correção:**
- Quando os workers estiverem ativos, buscar `CrmAutomationLog` real da API
- Mostrar badge "Simulado" quando logs são derivados do flowJson

---

## BUG 4 — Sem fallback para conexão Redis nos SSE

**Severidade:** 🟡 Média
**Local:** `app/api/crm/stream/route.ts`

**Problema:**
- Se Redis não está disponível, o SSE stream abre mas nunca recebe eventos
- O heartbeat mantém a conexão viva indefinidamente sem dados

**Correção:**
- Retornar header `X-CRM-Realtime: degraded` quando Redis está offline
- O hook `use-crm-stream.ts` deve mostrar badge "Modo offline" na UI
- Implementar polling fallback (fetch a cada 30s) quando SSE está degradado

---

## BUG 5 — CSP potencialmente bloqueando fontes Google

**Severidade:** 🟢 Baixa
**Local:** `next.config.ts` + `middleware.ts`

**Problema:**
- Cormorant Garamond e DM Sans são fontes Google
- Se CSP não inclui `fonts.googleapis.com` e `fonts.gstatic.com`, as fontes não carregam

**Correção:**
- Verificar se CSP inclui:
  ```
  font-src 'self' fonts.gstatic.com;
  style-src 'self' 'unsafe-inline' fonts.googleapis.com;
  ```

---

## BUG 6 — Sem validação de tamanho no upload de PDF (RAG)

**Severidade:** 🟡 Média (pode crashar o servidor)
**Local:** `app/api/admin/crm/knowledge/route.ts`

**Problema:**
- Não há limite de tamanho para upload de PDF
- Um PDF de 100MB pode esgotar memória do servidor

**Correção:**
- Adicionar validação: `if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'PDF máximo de 10MB' }, { status: 413 })`

---

## PROBLEMAS DE PERFORMANCE

### P1 — Pipeline carrega todos os leads de uma vez
**Local:** Pipeline page fetches ALL leads
**Impacto:** Com 500+ leads, pode ficar lento
**Correção:** Paginação por estágio (top 20 por coluna) + "Carregar mais"

### P2 — Inbox carrega todas as conversas
**Local:** Inbox page
**Impacto:** Com 200+ conversas, primeira carga pode ser lenta
**Correção:** Virtual list (react-window) para conversas

### P3 — Contacts page sem virtualização
**Local:** Contacts page
**Impacto:** 25 por página está ok, mas sorting/filtering roda no client com todos os dados
**Correção:** Mover filtros para server-side quando ultrapassar 500 leads

---

## PROBLEMAS DE SEGURANÇA

### S1 — Webhook Evolution API: validação de assinatura pode ser bypassada
**Local:** `app/api/webhooks/evolution/route.ts`
**Problema:** Se `EVOLUTION_WEBHOOK_SECRET` não está definido, aceita qualquer request
**Correção:** Em produção, rejeitar se secret não estiver configurado

### S2 — Rate limit em memória não persiste entre deploys
**Local:** `src/lib/rate-limit.ts`
**Impacto:** Após redeploy, todos os contadores resetam
**Correção:** Baixo risco para o volume atual, mas idealmente usar Redis para rate limiting

---

## ORDEM DE CORREÇÃO RECOMENDADA

| # | Bug | Esforço | Impacto |
|---|---|---|---|
| 1 | Pipeline mobile (BUG 1) | 30min | 🔴 Alto |
| 2 | Banner "sem workers" na Intelligence (BUG 2) | 20min | 🟡 Médio |
| 3 | Validação de tamanho PDF (BUG 6) | 5min | 🟡 Médio |
| 4 | SSE fallback offline (BUG 4) | 1h | 🟡 Médio |
| 5 | Webhook secret em produção (S1) | 10min | 🟡 Médio |
| 6 | CSP fontes Google (BUG 5) | 10min | 🟢 Baixo |
| 7 | Automation log real (BUG 3) | Fase 2+ | 🟢 Baixo |
| 8 | Paginação pipeline (P1) | 2h | 🟢 Futuro |
| 9 | Virtual list inbox (P2) | 2h | 🟢 Futuro |

---

*FIXES.md v1.0 — 12/03/2026*
