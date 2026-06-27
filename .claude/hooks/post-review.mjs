#!/usr/bin/env node
/**
 * POST-REVIEW HOOK — Code Review automatico pos-edicao
 *
 * Hook PostToolUse: dispara DEPOIS de Edit e Write.
 * Age como um QA Senior revisando o que foi feito.
 * Nao bloqueia — apenas da feedback construtivo.
 */

// Lembretes contextuais baseados no tipo de arquivo editado
const FILE_REMINDERS = [
  {
    pattern: /\/api\/.*route\.ts$/i,
    reminder: [
      '[QA Senior] Voce editou uma API route. Checklist rapido:',
      '  1. Tem verifyToken() + role check no inicio?',
      '  2. Input validado com Zod?',
      '  3. Erros retornam status code correto (400, 401, 404, 500)?',
      '  4. Se e webhook, esta no PUBLIC_PATHS do middleware?',
      '  5. Tem try/catch com console.error?',
      '',
      '  DICA: Consulte rotas existentes em app/api/crm/ como referencia.',
    ].join('\n'),
  },
  {
    pattern: /\/crm\/.*page\.tsx$/i,
    reminder: [
      '[QA Senior] Voce editou uma pagina CRM. Checklist rapido:',
      '  1. E Server Component por padrao? ("use client" so nas folhas)',
      '  2. Tem estado de loading (skeleton, nao spinner)?',
      '  3. Tem estado vazio com ilustracao contextual?',
      '  4. Tem tratamento de erro?',
      '  5. Todas as queries filtram deletedAt: null?',
      '  6. Segue o design system? (--crm-bg, --crm-surface, bordas 12px)',
      '',
      '  DICA: Use o padrao visual de app/admin/crm/pipeline/page.tsx como referencia.',
    ].join('\n'),
  },
  {
    pattern: /components\/crm\/.*\.tsx$/i,
    reminder: [
      '[QA Senior] Voce editou um componente CRM. Checklist rapido:',
      '  1. Props tipadas com interface (nao type)?',
      '  2. "use client" so se tem interatividade (onClick, useState)?',
      '  3. Animacoes usam Framer Motion com spring physics?',
      '  4. Cores usam variaveis CSS (--crm-*)?',
      '  5. Acessibilidade: aria-labels, keyboard navigation?',
      '',
      '  DICA: Siga o padrao de LeadCard.tsx e StageColumn.tsx.',
    ].join('\n'),
  },
  {
    pattern: /actions\/crm\/.*\.ts$/i,
    reminder: [
      '[QA Senior] Voce editou uma Server Action. Checklist rapido:',
      '  1. Tem "use server" no topo?',
      '  2. Input validado com Zod schema?',
      '  3. Tem verifyToken() + role === "ADMIN"?',
      '  4. Operacoes multi-tabela usam prisma.$transaction()?',
      '  5. Acoes sensiveis tem criarLogAuditoria()?',
      '  6. Retorna tipo consistente (success/error)?',
      '',
      '  DICA: Consulte actions/crm/move-lead.ts como referencia.',
    ].join('\n'),
  },
  {
    pattern: /workers\/crm\/.*\.ts$/i,
    reminder: [
      '[QA Senior] Voce editou um worker. Checklist rapido:',
      '  1. Tem tratamento de erro com try/catch?',
      '  2. Jobs falhos vao para DLQ (moverParaDLQ)?',
      '  3. Timeout configurado (nao deixar job rodando infinito)?',
      '  4. Log estruturado (nao console.log, use console.error em catch)?',
      '  5. Idempotente (rodar 2x nao causa duplicata)?',
      '',
      '  DICA: Workers sao processo separado. Teste com npx tsx workers/crm/index.ts.',
    ].join('\n'),
  },
  {
    pattern: /schema\.prisma$/i,
    reminder: [
      '[QA Senior] Voce editou o schema Prisma. ATENCAO:',
      '  1. VERIFICOU que nao alterou nenhum model existente?',
      '  2. Novos models estao no FINAL do arquivo?',
      '  3. Tem @@index() para queries frequentes?',
      '  4. FKs para models existentes sao opcionais (String?)?',
      '  5. Tem tenantId em todo model CRM?',
      '',
      '  PROXIMO PASSO: npx prisma migrate dev --name descricao',
      '  ANTES de rodar, revise o SQL gerado na pasta prisma/migrations/.',
    ].join('\n'),
  },
  {
    pattern: /src\/lib\/.*\.ts$/i,
    reminder: [
      '[QA Senior] Voce editou uma lib. Checklist rapido:',
      '  1. Exporta tipos/interfaces junto com as funcoes?',
      '  2. Funcoes tem JSDoc com descricao do que fazem?',
      '  3. Erros sao tratados (nao deixa promise sem catch)?',
      '  4. Se usa env var, tem fallback ou erro claro?',
      '',
      '  DICA: Veja src/lib/evolution-api.ts como exemplo de lib bem estruturada.',
    ].join('\n'),
  },
  {
    pattern: /stores\/.*\.ts$/i,
    reminder: [
      '[QA Senior] Voce editou um Zustand store. Checklist rapido:',
      '  1. Estado minimo (nao duplicar dados do servidor)?',
      '  2. Actions separadas do state?',
      '  3. Usa immer ou spread correto para imutabilidade?',
      '  4. Selectors especificos (nao useStore() sem selector)?',
    ].join('\n'),
  },
]

// Dica geral para pesquisa
const RESEARCH_REMINDER = [
  '',
  '[QA Senior] Dica geral: se voce usou uma lib/API que nao tem 100% certeza da sintaxe,',
  'use o MCP context7 para consultar a documentacao oficial antes de prosseguir:',
  '  1. mcp__context7__resolve-library-id para encontrar a lib',
  '  2. mcp__context7__query-docs para buscar a funcao/API especifica',
  '',
  'Melhor perder 10s consultando doc do que 10min debugando erro de API.',
].join('\n')

// ═══════════════════════════════════════════════════════════════════
// ENTRY POINT
// ═══════════════════════════════════════════════════════════════════

let data = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', chunk => { data += chunk })
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data)
    const tool = input.tool_name
    const ti = input.tool_input || {}

    if (tool !== 'Edit' && tool !== 'Write') {
      console.log(JSON.stringify({}))
      return
    }

    const filePath = (ti.file_path || '').replace(/\\/g, '/')

    for (const { pattern, reminder } of FILE_REMINDERS) {
      if (pattern.test(filePath)) {
        console.log(JSON.stringify({
          decision: 'allow',
          reason: reminder + RESEARCH_REMINDER,
        }))
        return
      }
    }

    // Arquivo nao reconhecido — silencio
    console.log(JSON.stringify({}))
  } catch {
    console.log(JSON.stringify({}))
  }
})
process.stdin.resume()
