import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { rateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

/**
 * Chatbot Myka IA — Sistema inteligente de fluxos por botões + NLP local.
 * Suporta n8n como upgrade (N8N_CHATBOT_WEBHOOK_URL), mas funciona 100% standalone.
 *
 * O frontend envia:
 *   { message, sessionId, context?, flowAction? }
 *
 * flowAction: indica clique em botão de fluxo (não é texto livre)
 * context: 'client_area' | 'public'
 *
 * Retorna:
 *   { response, buttons?, source }
 */

const N8N_URL = process.env.N8N_CHATBOT_WEBHOOK_URL || ''

// ═══════════════════════════════════════════
// 1. KNOWLEDGE BASE — tudo sobre o negócio
// ═══════════════════════════════════════════
const KNOWLEDGE = {
  nome: 'Mykaele Procópio',
  negocio: 'Home Spa Premium — Estética Avançada & Arquitetura Corporal',
  descricao: 'Mykaele é fisioterapeuta dermatofuncional especializada em arquitetura corporal. Atendimento premium em domicílio ou no Home Spa.',
  endereco: 'Rua Francisco Martiniano Barbosa, 888, Sapiranga, Fortaleza-CE',
  telefone: '(85) 99908-6924',
  whatsapp: '5585999086924',
  horarios: 'Segunda a sábado, 8h às 19h. Domingos sob agendamento especial.',
  pagamentos: 'PIX, cartão de crédito (até 12x pelo Mercado Pago), dinheiro.',
  diferenciais: [
    'Atendimento domiciliar (Home Spa)',
    'Fisioterapeuta Dermatofuncional',
    'Protocolos personalizados',
    'Tecnologia de ponta',
    'Ambiente premium e exclusivo',
    'Acompanhamento de evolução corporal',
  ],
  cuidados_pos: [
    'Beber pelo menos 2L de água nas próximas 4h',
    'Evitar banho quente por 4h',
    'Aplicar hidratante na área tratada após 24h',
    'Usar protetor solar diariamente',
    'Evitar exercício intenso por 24h',
    'Manter alimentação leve e balanceada',
  ],
}

// ═══════════════════════════════════════════
// 2. INTENT DETECTION (NLP simples + preciso)
// ═══════════════════════════════════════════
interface DetectedIntent {
  intent: string
  confidence: number
}

const INTENT_PATTERNS: Array<{ intent: string; patterns: string[]; weight: number }> = [
  { intent: 'greeting', patterns: ['oi','olá','ola','bom dia','boa tarde','boa noite','eai','e ai','oie','hey','hello','hi'], weight: 1 },
  { intent: 'thanks', patterns: ['obrigad','valeu','thanks','brigad','agradeço','grata'], weight: 1 },
  { intent: 'bye', patterns: ['tchau','bye','até logo','ate logo','falou','flw','adeus'], weight: 1 },
  { intent: 'schedule', patterns: ['agendar','agendamento','marcar','reservar','hora disponivel','horario disponivel','quero marcar','quero agendar','sessao','sessão'], weight: 2 },
  { intent: 'prices', patterns: ['preco','preço','valor','quanto custa','custo','tabela','quanto é','quanto e'], weight: 2 },
  { intent: 'services', patterns: ['procedimento','serviço','servico','tratamento','o que faz','quais serviços','quais servicos','protocolo','arquitetura corporal'], weight: 2 },
  { intent: 'packages', patterns: ['pacote','combo','desconto','promoção','promocao','kit','plano'], weight: 2 },
  { intent: 'location', patterns: ['endereco','endereço','localização','localizacao','onde fica','como chego','local','endereço','mapa','rua'], weight: 2 },
  { intent: 'hours', patterns: ['horario','horário','funciona','abre','fecha','atendimento','que horas','expediente'], weight: 2 },
  { intent: 'payment', patterns: ['pagamento','pagar','parcela','pix','cartao','cartão','boleto','financia','crédito','credito','mercado pago'], weight: 2 },
  { intent: 'about', patterns: ['sobre','quem é','quem e','sobre a mykaele','formação','experiencia','experiência','curriculo','currículo'], weight: 1.5 },
  { intent: 'aftercare', patterns: ['cuidado','pós','pos','depois da sessão','recomendaç','recomendac','water','agua','água','protetor'], weight: 1.5 },
  { intent: 'results', patterns: ['resultado','antes e depois','antes depois','funciona mesmo','depoimento','testemunho','foto'], weight: 1.5 },
  { intent: 'human', patterns: ['falar com alguem','falar com humano','atendente','pessoa real','falar com mykaele','ligar'], weight: 2 },
]

function detectIntent(message: string): DetectedIntent {
  const lower = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  let bestIntent = 'unknown'
  let bestScore = 0

  for (const { intent, patterns, weight } of INTENT_PATTERNS) {
    let matches = 0
    for (const p of patterns) {
      if (lower.includes(p)) matches++
    }
    const score = matches * weight
    if (score > bestScore) {
      bestScore = score
      bestIntent = intent
    }
  }

  return { intent: bestIntent, confidence: Math.min(bestScore / 2, 1) }
}

// ═══════════════════════════════════════════
// 3. FLOW BUTTONS
// ═══════════════════════════════════════════
interface FlowButton {
  label: string
  action: string    // flowAction id
  emoji?: string
}

// ═══════════════════════════════════════════
// 4. RESPONSE GENERATION
// ═══════════════════════════════════════════
async function generateResponse(
  message: string,
  flowAction: string | null,
  context: string,
  sessionId: string,
): Promise<{ response: string; buttons: FlowButton[] }> {

  // Se é ação de botão de fluxo, trata direto
  if (flowAction) {
    return handleFlowAction(flowAction)
  }

  // Detect intent do texto livre
  const { intent, confidence } = detectIntent(message)

  switch (intent) {
    case 'greeting':
      return {
        response: getGreeting(),
        buttons: getMainMenu(),
      }

    case 'thanks':
      return {
        response: 'Por nada! 😊💖 Fico feliz em ajudar.\n\nSe precisar de mais alguma coisa, é só perguntar!',
        buttons: [
          { label: 'Menu principal', action: 'main_menu', emoji: '🏠' },
          { label: 'Agendar sessão', action: 'flow_schedule', emoji: '📅' },
        ],
      }

    case 'bye':
      return {
        response: 'Até mais! 👋💕\n\nFoi um prazer te atender. Quando quiser voltar, estarei aqui!\n\n✨ Mykaele Procópio Home Spa',
        buttons: [],
      }

    case 'schedule':
      return handleFlowAction('flow_schedule')

    case 'prices':
    case 'services':
      return await handleFlowAction('flow_services')

    case 'packages':
      return await handleFlowAction('flow_packages')

    case 'location':
      return {
        response: `📍 *Localização*\n\n${KNOWLEDGE.endereco}\n\n🏠 Também atendemos em domicílio (Home Spa)! A Mykaele vai até você com todo o equipamento premium.\n\n💡 Para atendimento domiciliar, pode haver uma taxa de deslocamento dependendo da localização.`,
        buttons: [
          { label: 'Agendar atendimento', action: 'flow_schedule', emoji: '📅' },
          { label: 'Falar no WhatsApp', action: 'flow_whatsapp', emoji: '📱' },
          { label: 'Voltar ao menu', action: 'main_menu', emoji: '🏠' },
        ],
      }

    case 'hours':
      return {
        response: `⏰ *Horários de Atendimento*\n\n${KNOWLEDGE.horarios}\n\n📅 Para garantir seu horário, recomendo agendar com antecedência pelo nosso site!`,
        buttons: [
          { label: 'Agendar agora', action: 'flow_schedule', emoji: '📅' },
          { label: 'Ver serviços', action: 'flow_services', emoji: '✨' },
          { label: 'Voltar ao menu', action: 'main_menu', emoji: '🏠' },
        ],
      }

    case 'payment':
      return {
        response: `💳 *Formas de Pagamento*\n\n✅ PIX (à vista)\n✅ Cartão de crédito — até 12x pelo Mercado Pago\n✅ Dinheiro\n\n🎁 Nossos pacotes oferecem desconto especial! Quanto mais sessões, melhor o valor.\n\n💡 O pagamento online pelo site é seguro e rápido.`,
        buttons: [
          { label: 'Ver pacotes', action: 'flow_packages', emoji: '🎁' },
          { label: 'Agendar sessão', action: 'flow_schedule', emoji: '📅' },
          { label: 'Voltar ao menu', action: 'main_menu', emoji: '🏠' },
        ],
      }

    case 'about':
      return {
        response: `✨ *Sobre a Mykaele Procópio*\n\n${KNOWLEDGE.descricao}\n\n🎓 Diferenciais:\n${KNOWLEDGE.diferenciais.map(d => `  • ${d}`).join('\n')}\n\n💖 Cada protocolo é personalizado para suas necessidades e objetivos!`,
        buttons: [
          { label: 'Ver serviços', action: 'flow_services', emoji: '✨' },
          { label: 'Agendar avaliação', action: 'flow_schedule', emoji: '📅' },
          { label: 'Voltar ao menu', action: 'main_menu', emoji: '🏠' },
        ],
      }

    case 'aftercare':
      return {
        response: `🩹 *Cuidados Pós-Sessão*\n\n${KNOWLEDGE.cuidados_pos.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n\n⚠️ Esses são cuidados gerais. A Mykaele vai te passar orientações específicas para o seu procedimento!\n\n💧 A hidratação é o mais importante de tudo!`,
        buttons: [
          { label: 'Agendar retorno', action: 'flow_schedule', emoji: '📅' },
          { label: 'Falar com Mykaele', action: 'flow_whatsapp', emoji: '📱' },
          { label: 'Voltar ao menu', action: 'main_menu', emoji: '🏠' },
        ],
      }

    case 'results':
      return {
        response: `📸 *Resultados Reais*\n\nNossos resultados falam por si! Você pode conferir fotos de antes e depois na nossa galeria do site.\n\n✨ Cada protocolo é documentado com fotos de evolução para que você acompanhe seu progresso.\n\n🔗 Acesse: mykaprocopio.com.br/galeria-resultados`,
        buttons: [
          { label: 'Agendar avaliação', action: 'flow_schedule', emoji: '📅' },
          { label: 'Ver serviços', action: 'flow_services', emoji: '✨' },
          { label: 'Voltar ao menu', action: 'main_menu', emoji: '🏠' },
        ],
      }

    case 'human':
      return {
        response: `📱 *Falar com a Mykaele*\n\nClaro! Você pode falar diretamente com a Mykaele pelo WhatsApp:\n\n📞 ${KNOWLEDGE.telefone}\n\n💬 Ou clique no botão abaixo para abrir a conversa direto!`,
        buttons: [
          { label: 'Abrir WhatsApp', action: 'flow_whatsapp', emoji: '💬' },
          { label: 'Voltar ao menu', action: 'main_menu', emoji: '🏠' },
        ],
      }

    default:
      // Não entendeu — oferece menu
      if (confidence < 0.3) {
        return {
          response: `Hmm, não tenho certeza se entendi... 🤔\n\nPosso te ajudar com essas opções:`,
          buttons: getMainMenu(),
        }
      }
      return {
        response: `Entendo! Deixa eu te ajudar com isso. Escolha uma opção:`,
        buttons: getMainMenu(),
      }
  }
}

// ═══════════════════════════════════════════
// 5. FLOW ACTIONS (botões clicáveis)
// ═══════════════════════════════════════════
async function handleFlowAction(action: string): Promise<{ response: string; buttons: FlowButton[] }> {
  switch (action) {
    case 'main_menu':
      return {
        response: getGreeting(),
        buttons: getMainMenu(),
      }

    case 'flow_schedule':
      return {
        response: `📅 *Agendar Sessão*\n\nÓtima escolha! Para agendar é super fácil:\n\n1️⃣ Acesse nosso site\n2️⃣ Escolha o serviço\n3️⃣ Selecione data e horário\n4️⃣ Confirme o agendamento\n\n🔗 Link direto: mykaprocopio.com.br/cliente/agendar\n\n💡 Primeira vez? A avaliação é inclusa na sessão!`,
        buttons: [
          { label: 'Ir para agendamento', action: 'link_schedule', emoji: '🔗' },
          { label: 'Ver serviços primeiro', action: 'flow_services', emoji: '✨' },
          { label: 'Falar com Mykaele', action: 'flow_whatsapp', emoji: '📱' },
          { label: 'Voltar ao menu', action: 'main_menu', emoji: '🏠' },
        ],
      }

    case 'flow_services': {
      // Buscar serviços reais do banco
      try {
        const services = await prisma.service.findMany({
          where: { active: true, isAddon: false },
          orderBy: { price: 'asc' },
        })

        if (services.length > 0) {
          const serviceList = services.map(s => {
            const priceStr = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(s.price)
            const duration = s.duration >= 60 ? `${Math.floor(s.duration / 60)}h${s.duration % 60 > 0 ? `${s.duration % 60}min` : ''}` : `${s.duration}min`
            return `✨ *${s.name}*\n   ${s.description || ''}\n   ⏱ ${duration} · 💰 ${priceStr}`
          }).join('\n\n')

          return {
            response: `🌟 *Nossos Serviços*\n\n${serviceList}\n\n💡 Todos os protocolos são personalizados para suas necessidades!`,
            buttons: [
              { label: 'Agendar sessão', action: 'flow_schedule', emoji: '📅' },
              { label: 'Ver pacotes', action: 'flow_packages', emoji: '🎁' },
              { label: 'Formas de pagamento', action: 'flow_payment', emoji: '💳' },
              { label: 'Voltar ao menu', action: 'main_menu', emoji: '🏠' },
            ],
          }
        }
      } catch {
        // Falha no banco → resposta genérica
      }

      return {
        response: `🌟 *Nossos Serviços*\n\nOferecemos protocolos de:\n\n✨ Arquitetura Corporal\n✨ Drenagem Linfática\n✨ Tratamentos Faciais\n✨ Massagens Terapêuticas\n✨ E muito mais!\n\n💡 Para valores detalhados, confira no nosso site ou fale com a Mykaele!`,
        buttons: [
          { label: 'Agendar sessão', action: 'flow_schedule', emoji: '📅' },
          { label: 'Ver pacotes', action: 'flow_packages', emoji: '🎁' },
          { label: 'Voltar ao menu', action: 'main_menu', emoji: '🏠' },
        ],
      }
    }

    case 'flow_packages': {
      try {
        const services = await prisma.service.findMany({
          where: { active: true },
          include: { packageOptions: { where: { active: true }, orderBy: { price: 'asc' } } },
        })

        const withPkgs = services.filter(s => s.packageOptions.length > 0)
        if (withPkgs.length > 0) {
          const pkgList = withPkgs.map(s => {
            const opts = s.packageOptions.map(po => {
              const price = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(po.price)
              const perSession = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(po.price / po.sessions)
              return `   📦 ${po.name} — ${po.sessions} sessões por ${price} (${perSession}/sessão)`
            }).join('\n')
            return `🌟 *${s.name}*\n${opts}`
          }).join('\n\n')

          return {
            response: `🎁 *Pacotes Disponíveis*\n\n${pkgList}\n\n💡 Pacotes são a melhor forma de economizar! Quanto mais sessões, melhor o desconto.`,
            buttons: [
              { label: 'Agendar / Comprar', action: 'flow_schedule', emoji: '📅' },
              { label: 'Formas de pagamento', action: 'flow_payment', emoji: '💳' },
              { label: 'Voltar ao menu', action: 'main_menu', emoji: '🏠' },
            ],
          }
        }
      } catch {}

      return {
        response: `🎁 *Pacotes*\n\nTemos pacotes com descontos especiais! Acesse a área de pacotes no site para ver as opções atuais.\n\n💡 Quanto mais sessões, melhor o valor!`,
        buttons: [
          { label: 'Agendar sessão', action: 'flow_schedule', emoji: '📅' },
          { label: 'Voltar ao menu', action: 'main_menu', emoji: '🏠' },
        ],
      }
    }

    case 'flow_payment':
      return {
        response: `💳 *Formas de Pagamento*\n\n✅ PIX (à vista) — desconto especial!\n✅ Cartão de crédito — até 12x pelo Mercado Pago\n✅ Dinheiro\n\n🔒 Pagamento online seguro pelo Mercado Pago\n\n🎁 Pacotes têm desconto progressivo!`,
        buttons: [
          { label: 'Ver pacotes', action: 'flow_packages', emoji: '🎁' },
          { label: 'Agendar sessão', action: 'flow_schedule', emoji: '📅' },
          { label: 'Voltar ao menu', action: 'main_menu', emoji: '🏠' },
        ],
      }

    case 'flow_whatsapp':
      return {
        response: `📱 *Falar com a Mykaele*\n\n📞 ${KNOWLEDGE.telefone}\n\nClique no botão abaixo para abrir o WhatsApp direto! 💬`,
        buttons: [
          { label: 'Abrir WhatsApp', action: 'link_whatsapp', emoji: '💬' },
          { label: 'Voltar ao menu', action: 'main_menu', emoji: '🏠' },
        ],
      }

    case 'flow_location':
      return {
        response: `📍 *Como Funciona*\n\n🏠 *Home Spa (domicílio)*\nA Mykaele vai até você com todos os equipamentos premium!\n\n🏢 *Espaço Mykaele*\n${KNOWLEDGE.endereco}\n\n⏰ ${KNOWLEDGE.horarios}`,
        buttons: [
          { label: 'Agendar sessão', action: 'flow_schedule', emoji: '📅' },
          { label: 'Falar com Mykaele', action: 'flow_whatsapp', emoji: '📱' },
          { label: 'Voltar ao menu', action: 'main_menu', emoji: '🏠' },
        ],
      }

    case 'flow_aftercare':
      return {
        response: `🩹 *Cuidados Pós-Sessão*\n\n${KNOWLEDGE.cuidados_pos.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n\n⚠️ A Mykaele também passa orientações personalizadas após cada sessão!`,
        buttons: [
          { label: 'Agendar retorno', action: 'flow_schedule', emoji: '📅' },
          { label: 'Falar com Mykaele', action: 'flow_whatsapp', emoji: '📱' },
          { label: 'Voltar ao menu', action: 'main_menu', emoji: '🏠' },
        ],
      }

    case 'flow_about':
      return {
        response: `✨ *Mykaele Procópio*\n\n${KNOWLEDGE.descricao}\n\n🎓 *Diferenciais:*\n${KNOWLEDGE.diferenciais.map(d => `  • ${d}`).join('\n')}\n\n💖 Mais de centenas de clientes transformadas!`,
        buttons: [
          { label: 'Ver serviços', action: 'flow_services', emoji: '✨' },
          { label: 'Agendar avaliação', action: 'flow_schedule', emoji: '📅' },
          { label: 'Voltar ao menu', action: 'main_menu', emoji: '🏠' },
        ],
      }

    // Links especiais (tratados no frontend)
    case 'link_schedule':
    case 'link_whatsapp':
      return {
        response: 'Redirecionando...',
        buttons: [],
      }

    default:
      return {
        response: 'Como posso te ajudar? Escolha uma opção:',
        buttons: getMainMenu(),
      }
  }
}

// ═══════════════════════════════════════════
// 6. HELPERS
// ═══════════════════════════════════════════
function getGreeting(): string {
  const hour = new Date().getHours()
  let greeting = 'Olá'
  if (hour >= 5 && hour < 12) greeting = 'Bom dia'
  else if (hour >= 12 && hour < 18) greeting = 'Boa tarde'
  else greeting = 'Boa noite'

  return `${greeting}! ✨ Sou a Myka, assistente inteligente da *Mykaele Procópio Home Spa*.\n\nComo posso te ajudar hoje?`
}

function getMainMenu(): FlowButton[] {
  return [
    { label: 'Agendar sessão', action: 'flow_schedule', emoji: '📅' },
    { label: 'Nossos serviços', action: 'flow_services', emoji: '✨' },
    { label: 'Pacotes e preços', action: 'flow_packages', emoji: '🎁' },
    { label: 'Formas de pagamento', action: 'flow_payment', emoji: '💳' },
    { label: 'Localização e horários', action: 'flow_location', emoji: '📍' },
    { label: 'Cuidados pós-sessão', action: 'flow_aftercare', emoji: '🩹' },
    { label: 'Sobre a Mykaele', action: 'flow_about', emoji: '💖' },
    { label: 'Falar no WhatsApp', action: 'flow_whatsapp', emoji: '📱' },
  ]
}

// ═══════════════════════════════════════════
// 7. ROUTE HANDLER
// ═══════════════════════════════════════════
export async function POST(req: NextRequest) {
  try {
    // Rate limit: 30 messages per minute per IP
    const ip = getClientIP(req)
    const rl = rateLimit(`chatbot:${ip}`, 30, 60_000)
    if (!rl.allowed) return rateLimitResponse(rl.resetIn)

    const { message, sessionId, context, flowAction } = await req.json()

    if (!message && !flowAction) {
      return NextResponse.json({ error: 'Mensagem ou flowAction obrigatório' }, { status: 400 })
    }

    // Se tem n8n e NÃO é ação de fluxo, tenta n8n primeiro
    if (N8N_URL && !flowAction) {
      try {
        const n8nRes = await fetch(N8N_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            sessionId: sessionId || 'anonymous',
            context: context || 'public',
            timestamp: new Date().toISOString(),
          }),
          signal: AbortSignal.timeout(8000),
        })

        if (n8nRes.ok) {
          const data = await n8nRes.json()
          const response = data.response || data.output || data.text || data.message || data.answer
          if (response) {
            return NextResponse.json({
              response,
              buttons: data.buttons || [],
              source: 'n8n',
            })
          }
        }
      } catch {
        console.warn('[Myka IA] n8n indisponível, usando motor local')
      }
    }

    // Motor local inteligente
    const result = await generateResponse(
      message || '',
      flowAction || null,
      context || 'public',
      sessionId || 'anonymous',
    )

    return NextResponse.json({
      response: result.response,
      buttons: result.buttons,
      source: 'local',
    })

  } catch (error) {
    console.error('[Myka IA] Error:', error)
    return NextResponse.json({
      response: 'Desculpe, tive um probleminha técnico 😅\n\nTente novamente ou fale direto com a Mykaele:\n📱 (85) 99908-6924',
      buttons: [
        { label: 'Tentar novamente', action: 'main_menu', emoji: '🔄' },
        { label: 'WhatsApp direto', action: 'flow_whatsapp', emoji: '📱' },
      ],
      source: 'error',
    }, { status: 200 })
  }
}
