# GUARDIAN v2.0 — QA Senior & Engenheiro de Software

> Sistema automatico de protecao e mentoria tecnica.
> Roda em TODAS as conversas do Claude Code neste projeto.

---

## Persona

Age como um **QA Senior com 15+ anos de experiencia** que:
- Explica riscos com contexto tecnico
- Faz engenharia reversa dos arquivos (explica como funcionam por dentro)
- Sugere alternativas concretas com exemplos de codigo
- Analisa seguranca (XSS, SQL injection, vazamento de secrets)
- Analisa performance (awaits paralelos, queries otimizadas)
- Faz code review automatico apos cada edicao
- Incentiva consultar documentacao oficial antes de codar

---

## 2 Hooks ativos

### PreToolUse: guardian.mjs (ANTES de editar)
- Bloqueia arquivos criticos com explicacao detalhada
- Orienta em arquivos sensiveis com exemplos
- Detecta padroes de codigo proibidos
- Analisa seguranca e performance no conteudo
- Bloqueia comandos perigosos com alternativas

### PostToolUse: post-review.mjs (DEPOIS de editar)
- Code review contextual baseado no tipo de arquivo
- Checklists especificos: API routes, paginas, componentes, actions, workers, schema, libs, stores
- Lembrete para consultar docs via MCP context7

---

## Cobertura

| Tipo de Check | Exemplos | Acao |
|---|---|---|
| Arquivos protegidos | auth.ts, mercadopago.ts, layout.tsx | BLOQUEIA + explica |
| Arquivos sensiveis | middleware.ts, schema.prisma, package.json | PERMITE + orienta |
| Padroes de codigo | any, ts-ignore, console.log, N+1 | PERMITE + ensina |
| Seguranca | XSS, SQL injection, eval, env leak | PERMITE + alerta |
| Performance | awaits sequenciais, queries em serie | PERMITE + sugere |
| Comandos perigosos | rm -rf, DROP TABLE, npm run dev | BLOQUEIA + alternativa |
| Code review pos-edit | API routes, paginas, componentes | PERMITE + checklist |

---

## Arquivos

```
.claude/hooks/guardian.mjs      — Hook PreToolUse
.claude/hooks/post-review.mjs   — Hook PostToolUse
.claude/settings.local.json     — Registro dos hooks
.claude/GUARDIAN.md              — Esta documentacao
```

## Para usar em outro projeto

Copie a pasta `.claude/hooks/` e o bloco `"hooks"` do `settings.local.json`
para o `.claude/` do outro projeto. Depois adapte as regras (arquivos protegidos,
padroes de codigo) para o contexto daquele projeto.
