import { NextRequest, NextResponse } from 'next/server'

/**
 * Proxy para o webhook do n8n chatbot.
 * O n8n deve ter um workflow com "Webhook" trigger que recebe POST:
 *   { "message": "texto do cliente", "sessionId": "uuid" }
 * E retorna:
 *   { "response": "resposta do bot" }
 *
 * Variável de ambiente: N8N_CHATBOT_WEBHOOK_URL
 */

const N8N_URL = process.env.N8N_CHATBOT_WEBHOOK_URL || ''

// Respostas padrão quando n8n estiver offline (fallback inteligente)
const FAQ: Record<string, string> = {
  'horario|funciona|abre|fecha|atendimento|horário': 
    'Nosso atendimento é de segunda a sábado, das 8h às 19h. Domingos sob agendamento especial. 💆‍♀️',
  'preco|preço|valor|quanto custa|custo|tabela':
    'Os valores variam conforme o procedimento. Posso te ajudar a agendar uma avaliação gratuita! Acesse nosso site para ver os pacotes disponíveis. 💰',
  'endereco|endereço|localização|localizacao|onde fica|como chego':
    'Atendemos como Home Spa — vamos até você! 🏠 O endereço base é Rua Francisco Martiniano Barbosa, 888, Sapiranga, Fortaleza-CE.',
  'agendar|agendamento|marcar|reservar|consulta':
    'Para agendar, acesse nosso site e clique em "Agendar Agora"! Você pode escolher o serviço, data e horário. 📅',
  'procedimento|serviço|servico|tratamento|faz o que|o que vocês fazem':
    'Oferecemos diversos procedimentos de estética avançada: limpeza de pele, peeling, microagulhamento, drenagem linfática, massagens, e muito mais! 🌟',
  'pagamento|pagar|parcela|pix|cartao|cartão|boleto':
    'Aceitamos PIX, cartão de crédito (até 12x), boleto e Mercado Pago. Também temos pacotes com descontos especiais! 💳',
  'pacote|combo|desconto|promoção|promocao':
    'Temos pacotes com até 20% de desconto! Acesse a área de créditos no site para conferir as opções. 🎁',
  'oi|olá|ola|bom dia|boa tarde|boa noite|hey|hello|oie':
    'Olá! Bem-vinda ao atendimento Mykaele Procópio Home Spa! 💖 Como posso te ajudar hoje?',
  'obrigad|valeu|thanks|brigad':
    'Por nada! Estou aqui para ajudar. Se precisar de mais alguma coisa, é só chamar! 😊💕',
}

function getFallbackResponse(message: string): string {
  const lower = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  
  for (const [patterns, response] of Object.entries(FAQ)) {
    const keywords = patterns.split('|')
    if (keywords.some(kw => lower.includes(kw))) {
      return response
    }
  }
  
  return `Obrigada pelo contato! 💖 No momento estou com resposta automática.\n\nPara falar diretamente com a Mykaele, envie um WhatsApp:\n📱 (85) 99908-6924\n\nOu acesse nosso site para agendar online! 🌐`
}

export async function POST(req: NextRequest) {
  try {
    const { message, sessionId } = await req.json()

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Mensagem obrigatória' }, { status: 400 })
    }

    // Se tem URL do n8n configurada, tenta usar
    if (N8N_URL) {
      try {
        const n8nRes = await fetch(N8N_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            message, 
            sessionId: sessionId || 'anonymous',
            timestamp: new Date().toISOString(),
          }),
          signal: AbortSignal.timeout(10000), // 10s timeout
        })

        if (n8nRes.ok) {
          const data = await n8nRes.json()
          // n8n pode retornar em vários formatos
          const response = data.response || data.output || data.text || data.message || data.answer
          if (response) {
            return NextResponse.json({ response, source: 'n8n' })
          }
        }
      } catch {
        // n8n offline/timeout → usa fallback
        console.warn('[Chatbot] n8n indisponível, usando fallback local')
      }
    }

    // Fallback: respostas locais por FAQ
    const response = getFallbackResponse(message)
    return NextResponse.json({ response, source: 'fallback' })

  } catch {
    return NextResponse.json(
      { response: 'Desculpe, tive um problema. Tente novamente ou entre em contato pelo WhatsApp (85) 99908-6924 💖' },
      { status: 200 } // retorna 200 mesmo com erro, pra não quebrar o chat
    )
  }
}
