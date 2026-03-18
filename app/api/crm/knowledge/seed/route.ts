// app/api/crm/knowledge/seed/route.ts — Popula base de conhecimento com info do site
// Rota protegida: requer JWT ADMIN
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { upsertKnowledge } from '@/lib/rag'

const KNOWLEDGE_ENTRIES = [
  {
    title: 'Sobre a Clínica e a Profissional',
    sourceFile: 'seed-sobre.txt',
    content: `Mykaele Procópio é fisioterapeuta dermatofuncional com registro ativo no CREFITO, com mais de 7 anos de experiência clínica e mais de 500 pacientes atendidos. Ela é criadora do Método Mykaele Procópio, um protocolo exclusivo de Arquitetura Corporal — remodelação de alta performance que une a precisão da fisioterapia ao estímulo metabólico profundo.

A clínica fica em Sapiranga, Fortaleza (CE). Mykaele também atende em domicílio no formato Home Spa, levando toda a infraestrutura e equipamentos para a residência da paciente em qualquer bairro de Fortaleza.

Filosofia: "O Cuidado Além da Estética" — acredita que a beleza é resultado de um corpo em equilíbrio e uma alma em paz.

Contato: WhatsApp (85) 99908-6924 | Instagram: @mykaeleprocopio | Site: mykaprocopio.com.br`,
  },
  {
    title: 'Serviços e Preços',
    sourceFile: 'seed-servicos.txt',
    content: `MÉTODO MYKAELE PROCÓPIO (Arquitetura Corporal)
- Sessão avulsa: R$ 330 (60 minutos)
- Pacote 5 sessões: R$ 1.500 (R$ 300/sessão — 9% desconto)
- Pacote 10 sessões: R$ 2.800 (R$ 280/sessão — 15% desconto)
- Resultados desde a 1ª sessão: média de -4cm de redução
- Ação metabólica prolongada por até 48h após o atendimento
- Indicado para: remodelação abdominal, escultura corporal, contorno corporal, definição

MASSAGEM RELAXANTE
- Sessão avulsa: R$ 280 (60 minutos)
- Pacote 5 sessões: R$ 1.300 (R$ 260/sessão)
- Pacote 10 sessões: R$ 2.500 (R$ 250/sessão)
- Indicado para: alívio de tensão, bem-estar, relaxamento profundo

MANTA TÉRMICA (Complemento)
- R$ 80 (30 minutos)
- Potencializa os resultados do Método ou da Massagem
- Pode ser adicionada a qualquer sessão

Taxa de deslocamento para Home Spa: negociável conforme distância.`,
  },
  {
    title: 'Formatos de Atendimento',
    sourceFile: 'seed-formatos.txt',
    content: `FORMATO 1 — ATENDIMENTO EM CLÍNICA
- Local: clínica em Sapiranga, Fortaleza
- Instalações de alto padrão com privacidade absoluta
- Equipamentos de última geração
- Agenda limitada e restrita

FORMATO 2 — HOME SPA (DOMICÍLIO)
- Mykaele vai até a residência da paciente com toda a infraestrutura
- Atende em qualquer bairro de Fortaleza
- Mesmo nível de qualidade da clínica
- Vagas sob consulta — serviço exclusivo
- Taxa de deslocamento negociável

SIM, a Mykaele atende em domicílio! O Home Spa é um dos diferenciais da clínica.`,
  },
  {
    title: 'Horário de Funcionamento',
    sourceFile: 'seed-horario.txt',
    content: `HORÁRIO DE FUNCIONAMENTO:
- Segunda a sexta: 8h às 18h
- Sábado: 8h às 14h
- Domingo: fechado
- Intervalo de almoço: 12h às 13h

Cada sessão dura 60 minutos (Método e Massagem) ou 30 minutos (Manta Térmica).

Para agendar: pelo site mykaprocopio.com.br ou diretamente por aqui no WhatsApp. Basta informar o procedimento desejado e sua preferência de dia e horário que verificamos a disponibilidade.`,
  },
  {
    title: 'Resultados e Diferenciais',
    sourceFile: 'seed-resultados.txt',
    content: `RESULTADOS COMPROVADOS:
- Mais de 2.500 sessões realizadas
- 98% de satisfação das pacientes
- Avaliação média: 4.9 de 5.0 estrelas
- Média de -4cm de redução na 1ª sessão
- Ação metabólica prolongada por 48h

OS 3 PILARES DO MÉTODO:
1. Impacto Fisiológico Imediato: redução tangível de medidas desde a primeira sessão
2. Ação Metabólica Prolongada: estímulos manuais mantêm o corpo otimizando por até 48h
3. Flexibilidade: disponível na clínica ou no formato Home Spa

DIFERENCIAIS vs CONCORRENTES:
- Protocolo exclusivo criado pela Mykaele (não é genérico)
- Resultados mensuráveis e documentados
- Atendimento personalizado para cada paciente
- Opção de atendimento em domicílio (Home Spa)
- Profissional com formação em fisioterapia (não esteticista)`,
  },
  {
    title: 'Perguntas Frequentes (FAQ)',
    sourceFile: 'seed-faq.txt',
    content: `PERGUNTAS FREQUENTES:

P: Quantas sessões preciso para ver resultado?
R: A maioria das pacientes já nota resultado na 1ª sessão (média -4cm). Para resultados duradouros, recomendamos pacotes de 5 a 10 sessões, mas depende do objetivo de cada pessoa.

P: Quais formas de pagamento?
R: PIX (com desconto), cartão de crédito (até 12x), cartão de débito e dinheiro. Pagamento no dia do atendimento ou antecipado pelo site.

P: Precisa fazer avaliação antes?
R: Sim! A avaliação inicial é essencial para analisar suas necessidades, definir o protocolo personalizado e estabelecer expectativas. A avaliação pode ser agendada pelo site ou WhatsApp.

P: O procedimento dói?
R: Não! O Método é feito com técnicas manuais precisas. Algumas pacientes descrevem como uma massagem intensa, mas não dolorosa. A Mykaele ajusta a pressão conforme a sensibilidade de cada pessoa.

P: É seguro?
R: Sim. Todos os protocolos são desenvolvidos pela Mykaele, fisioterapeuta com formação e registro no CREFITO. Equipamentos são de última geração com todas as certificações.

P: Atende em casa?
R: SIM! O formato Home Spa é um dos diferenciais. A Mykaele leva toda a infraestrutura para sua residência em Fortaleza. Taxa de deslocamento negociável.

P: Tem estacionamento na clínica?
R: Sim, a clínica em Sapiranga tem estacionamento disponível para pacientes.

P: Posso cancelar ou reagendar?
R: Sim, pelo site ou WhatsApp. Pedimos aviso com pelo menos 24h de antecedência.`,
  },
  {
    title: 'Programa de Fidelidade e Indicação',
    sourceFile: 'seed-fidelidade.txt',
    content: `PROGRAMA DE FIDELIDADE:
- 4 níveis: Bronze → Prata → Ouro → Diamante
- Acumule pontos a cada sessão realizada
- Resgate recompensas exclusivas (descontos, brindes, sessões bônus)
- Benefícios especiais nos níveis mais altos
- Acompanhe seus pontos e nível em tempo real pelo app/site

PROGRAMA INDIQUE E GANHE:
- Compartilhe seu link exclusivo com amigas
- 1ª indicação confirmada: 5% de desconto
- 3 indicações: 10% de desconto (acumulativo)
- 5+ indicações: até 15% de desconto permanente
- Acompanhe suas indicações pelo painel no site

Os programas são gratuitos e automáticos — basta ter conta no site.`,
  },
]

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const tenantSlug = process.env.DEFAULT_TENANT_ID || 'clinica-mykaele-procopio'
    const tenant = await prisma.crmTenant.findUnique({ where: { slug: tenantSlug } })
    const tenantId = tenant?.id ?? tenantSlug

    const results: Array<{ title: string; chunks: number }> = []

    for (const entry of KNOWLEDGE_ENTRIES) {
      const chunks = await upsertKnowledge({
        tenantId,
        title: entry.title,
        content: entry.content,
        sourceFile: entry.sourceFile,
      })
      results.push({ title: entry.title, chunks })
    }

    const totalChunks = results.reduce((sum, r) => sum + r.chunks, 0)

    return NextResponse.json({
      ok: true,
      message: `Base de conhecimento populada: ${results.length} documentos, ${totalChunks} chunks`,
      results,
    })
  } catch (err) {
    console.error('[knowledge/seed] Erro:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
