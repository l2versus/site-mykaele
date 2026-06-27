#!/usr/bin/env node
/**
 * GUARDIAN HOOK — Conselheiro inteligente do projeto
 *
 * Dispara em PreToolUse para Edit, Write e Bash.
 * Em vez de apenas bloquear, EXPLICA o risco e sugere alternativas.
 * O objetivo e educar o agente, nao impedir o trabalho.
 */

// ═══════════════════════════════════════════════════════════════════
// ARQUIVOS PROTEGIDOS — bloqueia com explicacao detalhada
// ═══════════════════════════════════════════════════════════════════

const PROTECTED_FILES = [
  {
    path: 'src/lib/auth.ts',
    risco: 'Este arquivo controla TODA a autenticacao do sistema (JWT, verifyToken, roles ADMIN/PATIENT). Qualquer erro aqui derruba o login de todos os usuarios e trava o admin inteiro.',
    impacto: 'Se quebrar: ninguem consegue logar, todas as rotas protegidas retornam 401, o admin fica inacessivel.',
    alternativa: 'Se precisa de auth no CRM, use `import { verifyToken } from "@/lib/auth"` nos seus arquivos. Se precisa de um novo role, crie um wrapper em `src/lib/crm-auth.ts` que importa e estende o auth existente.',
  },
  {
    path: 'src/lib/mercadopago.ts',
    risco: 'Integra com Mercado Pago — processa pagamentos REAIS de pacientes. Um bug aqui pode cobrar valores errados ou perder pagamentos.',
    impacto: 'Se quebrar: pagamentos falham, pacientes sao cobrados errado, perda financeira direta.',
    alternativa: 'O CRM nao precisa tocar em pagamentos. Se precisa exibir info de pagamento de um lead, faca uma query READ-ONLY no model Payment sem alterar este arquivo.',
  },
  {
    path: 'src/lib/whatsapp.ts',
    risco: 'Cliente WhatsApp legado (CallMeBot) usado para notificacoes existentes. O CRM usa Evolution API, que e separado.',
    impacto: 'Se quebrar: notificacoes de agendamento param de funcionar para pacientes.',
    alternativa: 'Para WhatsApp no CRM, use `src/lib/evolution-api.ts` — e o cliente correto. Este arquivo (whatsapp.ts) e so para o sistema legado de notificacoes.',
  },
  {
    path: 'src/lib/email.ts',
    risco: 'Envia emails transacionais via Resend (confirmacoes, recuperacao de senha). Funciona em producao.',
    impacto: 'Se quebrar: pacientes nao recebem emails de confirmacao, recuperacao de senha para.',
    alternativa: 'Se o CRM precisa enviar email, crie `src/lib/crm-email.ts` que importa o Resend client separadamente, ou reutilize chamando as funcoes exportadas sem modificar o arquivo.',
  },
  {
    path: 'src/lib/rate-limit.ts',
    risco: 'Rate limiter em memoria que protege todas as APIs contra abuso/DDoS.',
    impacto: 'Se quebrar: APIs ficam vulneraveis a abuso, o servidor pode ser sobrecarregado.',
    alternativa: 'Se precisa de rate limit no CRM, importe e use: `import { rateLimit } from "@/lib/rate-limit"`. Nao precisa modificar.',
  },
  {
    path: 'src/lib/media-catalog.ts',
    risco: 'Catalogo de midias da vitrine 3D e sessoes. Usado pelo sistema de tickets.',
    impacto: 'Se quebrar: vitrine 3D e sessoes de fotos param de funcionar.',
    alternativa: 'O CRM tem seu proprio sistema de midia (cofre clinico via isClinicalMedia no Message). Nao precisa deste arquivo.',
  },
  {
    path: 'app/layout.tsx',
    risco: 'Layout RAIZ do Next.js — envolve TODAS as paginas do site (publico + admin). Inclui providers globais, fonts, metadata.',
    impacto: 'Se quebrar: o site INTEIRO para. Tela branca para todos os usuarios.',
    alternativa: 'O CRM tem seu proprio layout isolado em `app/admin/crm/layout.tsx`. Use esse para qualquer customizacao visual do CRM. Se precisa de um provider global, adicione no `app/admin/layout.tsx` (layout do admin, nao do site).',
  },
]

// ═══════════════════════════════════════════════════════════════════
// ARQUIVOS SENSIVEIS — permite mas explica os cuidados
// ═══════════════════════════════════════════════════════════════════

const SENSITIVE_FILES = [
  {
    pattern: 'middleware.ts',
    contexto: 'O middleware intercepta TODAS as requisicoes antes de chegarem nas rotas. Ele verifica JWT e bloqueia acesso nao autenticado.',
    cuidado: 'So faca ADICOES aos arrays PUBLIC_PATHS ou PUBLIC_PREFIXES. Nunca remova itens existentes, nunca altere a logica de verificacao de token.',
    exemplo: 'Para adicionar rota publica do CRM:\n  PUBLIC_PATHS: adicione "/api/webhooks/evolution"\n  PUBLIC_PREFIXES: adicione "/api/crm/stream" (SSE nao manda Bearer)',
    risco_se_errar: 'Rota removida do PUBLIC_PATHS = webhook para de funcionar (401). Logica de auth alterada = todas as rotas quebram.',
  },
  {
    pattern: 'prisma/schema.prisma',
    contexto: 'O schema tem 27 models de producao (User, Appointment, Payment, etc) + 17 models CRM. Todos estao em producao.',
    cuidado: 'NUNCA altere models existentes (especialmente Appointment, User, Payment, Package, Service, Schedule). Adicione novos models APENAS ao FINAL do arquivo.',
    exemplo: 'Para criar um novo model CRM, adicione depois do ultimo model existente. Use FKs opcionais (String?) para conectar com models existentes — nunca @relation() cruzando modulos.',
    risco_se_errar: 'Alterar model existente = migration destrutiva que pode apagar dados de producao. Renomear campo = perda de dados na coluna antiga.',
  },
  {
    pattern: 'docker-compose',
    contexto: 'Define os servicos Docker em producao no Coolify. Cada alteracao requer redeploy.',
    cuidado: 'So ADICIONE novos servicos (redis, evolution-api). Nunca altere configuracoes de servicos existentes (postgres, app).',
    exemplo: 'Para adicionar Redis: adicione um novo bloco "redis:" com imagem redis:7-alpine.',
    risco_se_errar: 'Alterar config do postgres = banco fica inacessivel. Alterar portas = servicos perdem conectividade.',
  },
  {
    pattern: 'next.config',
    contexto: 'Configuracao global do Next.js — afeta build, CSP, redirects, rewrites de TODAS as paginas.',
    cuidado: 'Alteracoes aqui afetam o site INTEIRO. Teste localmente antes de commitar. Nunca remova configuracoes existentes.',
    exemplo: 'Se precisa adicionar um dominio de imagem: adicione ao array images.remotePatterns.',
    risco_se_errar: 'CSP errado = recursos bloqueados. Rewrite errado = rotas quebradas. Build config errado = deploy falha.',
  },
  {
    pattern: 'package.json',
    contexto: 'Dependencias do projeto. Remover uma dependencia pode quebrar imports em dezenas de arquivos.',
    cuidado: 'So ADICIONE dependencias. Nunca remova ou faca downgrade de existentes. Verifique se a dependencia ja existe antes de instalar.',
    exemplo: 'Antes de adicionar: grep no package.json para ver se ja tem. Use `npm i nome-pacote` (sem --save-exact a menos que necessario).',
    risco_se_errar: 'Remover dependencia = build falha. Downgrade = APIs incompativeis. Duplicata = bundle inflado.',
  },
  {
    pattern: 'globals.css',
    contexto: 'CSS global com variaveis do site inteiro + variaveis CRM. Tailwind CSS 4 base.',
    cuidado: 'So ADICIONE novas variaveis CSS. Nunca altere ou remova variaveis existentes — elas sao usadas em dezenas de componentes.',
    exemplo: 'Para CRM, adicione novas variaveis com prefixo --crm- (ex: --crm-gold: #D4AF37).',
    risco_se_errar: 'Remover variavel = componentes ficam sem estilo. Alterar cor existente = site inteiro muda de visual.',
  },
  {
    pattern: 'app/admin/layout.tsx',
    contexto: 'Layout do painel admin com sidebar de navegacao (19+ itens). Inclui contexto de auth do admin.',
    cuidado: 'So ADICIONE novos itens ao array de navegacao. Nunca remova itens existentes ou altere o AdminContext.',
    exemplo: 'Para adicionar CRM ao menu: adicione { name: "CRM", href: "/admin/crm", icon: ... } ao array NAV.',
    risco_se_errar: 'Remover item = funcionalidade some do menu. Alterar AdminContext = auth do admin quebra.',
  },
]

// ═══════════════════════════════════════════════════════════════════
// PADROES DE CODIGO — avisa com explicacao do porque
// ═══════════════════════════════════════════════════════════════════

const CODE_PATTERNS = [
  {
    re: /:\s*any[\s;,)>]/g,
    problema: 'Tipo `any` detectado.',
    porque: 'Este projeto usa TypeScript estrito. `any` desabilita toda verificacao de tipo, escondendo bugs que so aparecem em producao.',
    alternativa: 'Use o tipo correto. Se nao sabe o tipo, use `unknown` com type guard, ou defina uma interface. Ex: `Record<string, unknown>` em vez de `any`.',
  },
  {
    re: /as\s+unknown/g,
    problema: '`as unknown` detectado.',
    porque: 'Cast duplo (`as unknown as X`) burla o type system. Isso esconde incompatibilidades reais entre tipos.',
    alternativa: 'Corrija o tipo na origem. Se e retorno de API, use Zod para validar: `const data = schema.parse(response)`. Se e Prisma, o tipo ja vem correto.',
  },
  {
    re: /\/\/\s*@ts-ignore/g,
    problema: '@ts-ignore detectado.',
    porque: 'Silencia QUALQUER erro TypeScript na linha seguinte — inclusive erros legitimos. Nunca se sabe o que esta escondendo.',
    alternativa: 'Resolva o erro de tipo. Se e um problema de tipagem de lib externa, use `declare module` no `types.d.ts`. Se e temporario, documente com // TODO e prazo.',
  },
  {
    re: /\/\/\s*@ts-expect-error/g,
    problema: '@ts-expect-error detectado.',
    porque: 'Similar ao @ts-ignore mas levemente melhor. Ainda assim esconde erros reais.',
    alternativa: 'Mesma solucao: resolva o tipo na origem. Se impossivel, pelo menos adicione comentario explicando POR QUE e quando sera removido.',
  },
  {
    re: /console\.log\s*\(/g,
    problema: 'console.log() detectado.',
    porque: 'Em producao, console.log polui os logs do servidor e pode vazar dados sensiveis (tokens, dados de pacientes).',
    alternativa: 'Use `console.error()` apenas dentro de blocos catch. Para debug local, use breakpoints ou remova antes de commitar.',
  },
  {
    re: /conversationId\s*[=:]\s*['"]PENDING['"]/g,
    problema: 'conversationId = "PENDING" detectado.',
    porque: 'O campo conversationId e FK para Conversation. "PENDING" nao e um ID valido e quebra queries com JOIN/include.',
    alternativa: 'Crie a Conversation PRIMEIRO, depois associe a mensagem. Use prisma.$transaction() para garantir atomicidade.',
  },
  {
    re: /file\.text\(\)/g,
    problema: 'file.text() detectado em contexto de PDF.',
    porque: 'PDFs sao binarios. file.text() corrompe o conteudo e retorna lixo.',
    alternativa: 'Use pdf-parse: `import pdf from "pdf-parse"; const data = await pdf(buffer); const text = data.text;`',
  },
  {
    re: /upsertJobScheduler/g,
    problema: 'upsertJobScheduler detectado.',
    porque: 'Essa funcao e do BullMQ Pro (pago). O projeto usa BullMQ free (open source).',
    alternativa: 'Use `queue.add("nome", dados, { repeat: { pattern: "0 8 * * *" } })` para tarefas recorrentes.',
  },
  {
    re: /include:\s*\{\s*leads:\s*true/g,
    problema: 'include: { leads: true } detectado — possivel N+1.',
    porque: 'Incluir todos os leads de um pipeline/stage carrega TUDO na memoria. Com 1000 leads, isso trava o servidor.',
    alternativa: 'Use 2 queries separadas + agrupamento em TypeScript:\n  1. `prisma.stage.findMany({ where: ... })`\n  2. `prisma.lead.findMany({ where: { stageId: { in: stageIds } } })`\n  Depois agrupe com `Map<stageId, Lead[]>`.',
  },
  {
    re: /\.delete\s*\(\s*\{[^}]*where[^}]*leadId/gm,
    problema: 'DELETE em Lead detectado.',
    porque: 'Leads NUNCA sao deletados — usam exclusao logica (deletedAt). Isso e requisito LGPD (Art. 18).',
    alternativa: 'Use `prisma.lead.update({ where: { id }, data: { deletedAt: new Date() } })`. Para exclusao definitiva (direito ao esquecimento), use `anonymizeLead()` de `src/lib/lgpd.ts`.',
  },
]

// ═══════════════════════════════════════════════════════════════════
// COMANDOS PERIGOSOS — bloqueia com explicacao
// ═══════════════════════════════════════════════════════════════════

const DANGEROUS_COMMANDS = [
  {
    re: /\brm\s+-rf\b/i,
    risco: 'rm -rf deleta arquivos recursivamente SEM confirmacao.',
    impacto: 'Pode apagar o projeto inteiro, node_modules, ou arquivos de configuracao criticos.',
    alternativa: 'Para limpar: use `rm -rf node_modules` especificamente (e seguro, reinstala com npm i). Para outros arquivos, delete um a um verificando antes.',
  },
  {
    re: /\bdrop\s+table\b/i,
    risco: 'DROP TABLE apaga tabela E TODOS OS DADOS permanentemente.',
    impacto: 'Dados de pacientes, agendamentos, pagamentos — tudo perdido. Sem backup automatico.',
    alternativa: 'Se precisa recriar tabela, use `prisma migrate dev` que gera migracao segura. Para limpar dados de teste, use DELETE com WHERE especifico.',
  },
  {
    re: /\bprisma\s+migrate\s+reset\b/i,
    risco: 'migrate reset APAGA todo o banco e recria do zero.',
    impacto: 'Todos os dados de producao perdidos: pacientes, agendamentos, pagamentos, leads, conversas.',
    alternativa: 'Use `prisma migrate dev` para migracoes incrementais. Se precisa resetar apenas em dev local, confirme que DATABASE_URL aponta para banco LOCAL, nao producao.',
  },
  {
    re: /\bgit\s+push\s+--force\b/i,
    risco: 'Force push sobrescreve o historico remoto.',
    impacto: 'Commits de outras pessoas/agentes sao perdidos. O Coolify faz deploy automatico — pode deployar codigo incompleto.',
    alternativa: 'Use `git push` normal. Se rejeitado, faca `git pull --rebase` primeiro. Se realmente precisa forcar, use `--force-with-lease` que protege contra sobrescrita.',
  },
  {
    re: /\bgit\s+reset\s+--hard\b/i,
    risco: 'Reset hard descarta TODAS as mudancas nao commitadas.',
    impacto: 'Todo codigo editado mas nao commitado e perdido permanentemente.',
    alternativa: 'Use `git stash` para guardar mudancas temporariamente. Ou `git checkout -- arquivo.ts` para reverter UM arquivo especifico.',
  },
  {
    re: /\bnpm\s+run\s+dev\b/i,
    risco: 'O dev server (Next.js + Turbopack) consome ~4GB de RAM nesta maquina.',
    impacto: 'Com Claude Code ja usando memoria, npm run dev trava o sistema inteiro (97% memoria). A maquina fica inutilizavel.',
    alternativa: 'Para testar, faca commit e push — o Coolify faz deploy automatico em ~2min. Para verificar tipos, use `npx tsc --noEmit`. Para verificar build, use `npx next build` (mais leve que dev).',
  },
]

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

function norm(filePath) {
  return (filePath || '').replace(/\\/g, '/').toLowerCase()
}

function formatProtected(file, filePath) {
  return [
    `GUARDIAN — ARQUIVO PROTEGIDO: ${filePath}`,
    ``,
    `RISCO: ${file.risco}`,
    ``,
    `O QUE ACONTECE SE QUEBRAR: ${file.impacto}`,
    ``,
    `O QUE VOCE PODE FAZER: ${file.alternativa}`,
  ].join('\n')
}

function formatSensitive(file) {
  return [
    `GUARDIAN — ARQUIVO SENSIVEL (permitido, mas com cuidado)`,
    ``,
    `CONTEXTO: ${file.contexto}`,
    ``,
    `CUIDADO: ${file.cuidado}`,
    ``,
    `EXEMPLO SEGURO: ${file.exemplo}`,
    ``,
    `SE ERRAR: ${file.risco_se_errar}`,
  ].join('\n')
}

function formatCodeWarn(matches) {
  const parts = ['GUARDIAN — PADROES DE CODIGO DETECTADOS', '']
  for (const m of matches) {
    parts.push(`[!] ${m.problema}`)
    parts.push(`    POR QUE E RUIM: ${m.porque}`)
    parts.push(`    FACA ASSIM: ${m.alternativa}`)
    parts.push('')
  }
  return parts.join('\n')
}

function formatCommandBlock(cmd) {
  return [
    `GUARDIAN — COMANDO PERIGOSO BLOQUEADO`,
    ``,
    `RISCO: ${cmd.risco}`,
    ``,
    `O QUE PODE ACONTECER: ${cmd.impacto}`,
    ``,
    `ALTERNATIVA SEGURA: ${cmd.alternativa}`,
  ].join('\n')
}

// ═══════════════════════════════════════════════════════════════════
// LOGICA PRINCIPAL
// ═══════════════════════════════════════════════════════════════════

function checkFile(filePath) {
  const p = norm(filePath)

  // Arquivos protegidos — BLOQUEIA com explicacao
  for (const file of PROTECTED_FILES) {
    if (p.endsWith(norm(file.path))) {
      return {
        decision: 'block',
        reason: formatProtected(file, file.path),
      }
    }
  }

  // Arquivos sensiveis — PERMITE com orientacao
  for (const file of SENSITIVE_FILES) {
    if (p.includes(norm(file.pattern))) {
      return {
        decision: 'allow',
        reason: formatSensitive(file),
      }
    }
  }

  return null
}

function checkContent(text) {
  if (!text) return null
  const matches = []
  for (const pat of CODE_PATTERNS) {
    pat.re.lastIndex = 0
    if (pat.re.test(text)) {
      matches.push(pat)
    }
  }
  if (matches.length > 0) {
    return { decision: 'allow', reason: formatCodeWarn(matches) }
  }
  return null
}

function checkBash(command) {
  if (!command) return null
  for (const cmd of DANGEROUS_COMMANDS) {
    cmd.re.lastIndex = 0
    if (cmd.re.test(command)) {
      return { decision: 'block', reason: formatCommandBlock(cmd) }
    }
  }
  return null
}

function merge(a, b) {
  if (!a) return b
  if (!b) return a
  if (a.decision === 'block') return a
  if (b.decision === 'block') return b
  return { decision: 'allow', reason: a.reason + '\n\n---\n\n' + b.reason }
}

// ═══════════════════════════════════════════════════════════════════
// ENTRY POINT — le stdin cross-platform
// ═══════════════════════════════════════════════════════════════════

let data = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', chunk => { data += chunk })
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data)
    const tool = input.tool_name
    const ti = input.tool_input || {}
    let result = null

    if (tool === 'Edit' || tool === 'Write') {
      const fileResult = checkFile(ti.file_path)
      if (fileResult && fileResult.decision === 'block') {
        result = fileResult
      } else {
        const contentResult = checkContent(ti.new_string || ti.content)
        result = merge(fileResult, contentResult)
      }
    } else if (tool === 'Bash') {
      result = checkBash(ti.command)
    }

    console.log(JSON.stringify(result || { decision: 'allow' }))
  } catch {
    console.log(JSON.stringify({ decision: 'allow' }))
  }
})
process.stdin.resume()
