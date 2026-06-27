// src/lib/ai-agent.ts — Agente Recepcionista IA
// Responde automaticamente no WhatsApp usando RAG + Gemini.
// Prioridade no webhook: Bot Builder > AI Agent > Auto-Reply
// Config armazenada em CrmIntegration (provider: 'ai-agent').
// Rastreio via LeadActivity (type: 'AI_AGENT_REPLY').

import { prisma } from '@/lib/prisma'
import { evolutionApi } from '@/lib/evolution-api'
import { findSimilarChunks } from '@/lib/rag'
import { createGeminiModel } from '@/lib/gemini'
import { sendHandoffNotification } from '@/lib/whatsapp'

interface AiAgentConfig {
  enabled: boolean
  agentName: string
  tone: 'formal' | 'informal' | 'carinhoso' | 'profissional'
  extraInstructions: string
  maxInteractions: number
  schedule: 'always' | 'outside_hours'
  businessHoursStart: string // "08:00"
  businessHoursEnd: string   // "18:00"
  model: string
  delayMs: number
}

const DEFAULT_CONFIG: AiAgentConfig = {
  enabled: false,
  agentName: 'Luna',
  tone: 'carinhoso',
  extraInstructions: '',
  maxInteractions: 50,
  schedule: 'always',
  businessHoursStart: '08:00',
  businessHoursEnd: '18:00',
  model: 'gemini-2.0-flash',
  delayMs: 3000,
}

const TONE_DESCRIPTIONS: Record<AiAgentConfig['tone'], string> = {
  formal: 'formal, educada e respeitosa',
  informal: 'descontraída, amigável e próxima',
  carinhoso: 'calorosa, acolhedora e empática, usando palavras carinhosas',
  profissional: 'profissional mas acessível, transmitindo confiança e competência',
}

/**
 * Detecta mensagens triviais que podem gerar loops desnecessários.
 * Emojis, "ok", "obrigado", saudações repetitivas, etc.
 */
function isLoopMessage(content: string): boolean {
  const normalized = content.trim().toLowerCase().replace(/[!?.…,]+$/g, '')

  // Mensagem é só emojis
  const emojiOnly = /^[\p{Emoji}\s]+$/u.test(content.trim())
  if (emojiOnly) return true

  // Palavras triviais que NÃO devem acionar a IA se já respondeu recentemente.
  // NÃO inclui saudações (oi, bom dia, etc.) — paciente pode estar retomando conversa.
  const trivialPatterns = [
    'ok', 'okay', 'tá', 'ta', 'beleza', 'blz', 'certo', 'entendi',
    'obrigado', 'obrigada', 'obg', 'valeu', 'vlw', 'grato', 'grata',
    'sim', 'não', 'nao', 'hmm', 'hm', 'uhum', 'aham', 'ss', 'nn',
    'show', 'top', 'legal', 'massa', 'perfeito', 'ótimo', 'otimo',
    'tudo bem', 'tudo bom', 'de boa', 'tranquilo', 'tranquila',
  ]

  return trivialPatterns.includes(normalized)
}

async function getAiAgentConfig(tenantId: string): Promise<AiAgentConfig | null> {
  const integration = await prisma.crmIntegration.findFirst({
    where: { tenantId, provider: 'ai-agent', isActive: true },
  })

  if (!integration) return null

  const creds = integration.credentials as Record<string, unknown> | null
  if (!creds) return null

  const config: AiAgentConfig = {
    enabled: creds.enabled === true,
    agentName: typeof creds.agentName === 'string' ? creds.agentName : DEFAULT_CONFIG.agentName,
    tone: (creds.tone as AiAgentConfig['tone']) ?? DEFAULT_CONFIG.tone,
    extraInstructions: typeof creds.extraInstructions === 'string' ? creds.extraInstructions : '',
    maxInteractions: typeof creds.maxInteractions === 'number' ? creds.maxInteractions : DEFAULT_CONFIG.maxInteractions,
    schedule: (creds.schedule as AiAgentConfig['schedule']) ?? DEFAULT_CONFIG.schedule,
    businessHoursStart: typeof creds.businessHoursStart === 'string' ? creds.businessHoursStart : DEFAULT_CONFIG.businessHoursStart,
    businessHoursEnd: typeof creds.businessHoursEnd === 'string' ? creds.businessHoursEnd : DEFAULT_CONFIG.businessHoursEnd,
    model: (creds.model as AiAgentConfig['model']) ?? DEFAULT_CONFIG.model,
    delayMs: typeof creds.delayMs === 'number' ? creds.delayMs : DEFAULT_CONFIG.delayMs,
  }

  if (!config.enabled) return null
  return config
}

/**
 * Verifica se o agente deve operar agora baseado no horário configurado.
 */
function isWithinSchedule(config: AiAgentConfig): boolean {
  if (config.schedule === 'always') return true

  const now = new Date()
  const brTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  const hours = brTime.getHours()
  const minutes = brTime.getMinutes()
  const currentMinutes = hours * 60 + minutes

  const [startH, startM] = config.businessHoursStart.split(':').map(Number)
  const [endH, endM] = config.businessHoursEnd.split(':').map(Number)
  const startMinutes = startH * 60 + startM
  const endMinutes = endH * 60 + endM

  // schedule === 'outside_hours': responde FORA do horário comercial
  const isBusinessHours = currentMinutes >= startMinutes && currentMinutes < endMinutes
  return !isBusinessHours
}

/**
 * Conta quantas vezes o agente IA já respondeu nesta conversa.
 */
async function countAiInteractions(leadId: string): Promise<number> {
  const count = await prisma.leadActivity.count({
    where: { leadId, type: 'AI_AGENT_REPLY' },
  })
  return count
}

/**
 * Busca histórico recente da conversa para contexto.
 */
async function getConversationHistory(
  tenantId: string,
  remoteJid: string,
  limit = 10
): Promise<{ history: string; lastMessage: string }> {
  const conversation = await prisma.conversation.findUnique({
    where: { tenantId_remoteJid: { tenantId, remoteJid } },
    select: { id: true },
  })

  if (!conversation) return { history: '', lastMessage: '' }

  const messages = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { fromMe: true, content: true, type: true },
  })

  const reversed = messages.reverse()
  const history = reversed
    .map(m => `${m.fromMe ? 'Clínica' : 'Paciente'}: ${m.content}`)
    .join('\n')

  const lastMessage = reversed.filter(m => !m.fromMe).pop()?.content ?? ''

  return { history, lastMessage }
}

/**
 * Gera resposta do agente IA usando RAG + Gemini.
 */
async function generateAgentReply(params: {
  tenantId: string
  leadName: string
  config: AiAgentConfig
  history: string
  userMessage: string
}): Promise<string> {
  const { tenantId, leadName, config, history, userMessage } = params

  // Buscar contexto relevante da base de conhecimento
  const chunks = await findSimilarChunks(tenantId, userMessage, 4, 0.5)
  const ragContext = chunks.map(c => c.content).join('\n\n---\n\n')

  // Contexto base da clínica (sempre presente, mesmo sem RAG)
  const clinicaBase = `INFORMAÇÕES DA CLÍNICA:
- Mykaele Procópio é fisioterapeuta dermatofuncional (CREFITO ativo)
- Especialidade: Arquitetura Corporal — protocolo exclusivo de remodelação
- Atende em CLÍNICA e também em DOMICÍLIO (Home Spa) em Fortaleza
- Procedimentos: massagem modeladora, drenagem linfática, lipocavitação, radiofrequência, entre outros
- Resultados desde a 1ª sessão (redução de medidas comprovada)
- Agendamento: via site mykaprocopio.com.br ou direto por aqui
- Horário de funcionamento: segunda a sábado`

  const context = ragContext ? `${clinicaBase}\n\n---\n\nBASE DE CONHECIMENTO:\n${ragContext}` : clinicaBase

  const firstName = leadName.split(' ')[0] || 'cliente'
  const toneDesc = TONE_DESCRIPTIONS[config.tone] ?? TONE_DESCRIPTIONS.profissional

  const systemPrompt = `Você é ${config.agentName}, concierge da Mykaele Procópio no WhatsApp. Você é uma pessoa real que trabalha na clínica — calorosa, atenciosa e que adora ajudar.

QUEM VOCÊ É:
- Seu nome é ${config.agentName}
- Você é a concierge (atendente) da Mykaele Procópio
- Você conhece TUDO sobre a clínica porque trabalha lá todo dia
- Mykaele é a dona e fisioterapeuta — você chama ela de "Myka" ou "a Myka"
- Você é ${toneDesc}

COMO VOCÊ FALA (OBRIGATÓRIO — quebrar essas regras é proibido):
- Você é uma PESSOA conversando no WhatsApp, NÃO um chatbot
- Mensagens CURTAS: 1-2 frases. Máximo 3 frases se precisar explicar algo
- Linguagem natural de WhatsApp: "sim!", "aí", "olha", "ah", "viu", "tá"
- NÃO use: bullet points, listas, formatação, asteriscos, negrito
- NÃO mande links — a não ser que a pessoa PEÇA
- NÃO diga: "nosso site", "visite", "acesse", "clique" — isso é coisa de robô
- NÃO se apresente toda vez — só na PRIMEIRA mensagem do histórico
- Emojis: use com naturalidade mas sem exagero (0-1 por msg)
- VARIE suas respostas — nunca repita a mesma frase/estrutura
- Use "vc", "pra", "tá" em vez de "você", "para", "está" (WhatsApp real)

EXEMPLOS DE COMO FALAR:
✅ "Sim, a Myka atende em domicílio sim! É o Home Spa 😊"
✅ "Olha, a sessão do Método fica R$330, e tem pacote de 5 por R$1.500"
✅ "Deixa eu ver a agenda da Myka e te falo!"
✅ "Ah que legal! Vc vai amar, sério"
❌ "Olá! Seja bem-vinda à Clínica Mykaele Procópio! Visite nosso site..."
❌ "Nossos serviços incluem: 1. Método... 2. Massagem... 3. Manta..."
❌ "Para mais informações, acesse https://..."

SEU CONHECIMENTO SOBRE A CLÍNICA:
${context}

REGRA ABSOLUTA — NÃO DELIRAR:
- SÓ responda com informações que estão no conhecimento acima
- Se NÃO sabe: "Vou confirmar com a Myka e te retorno, tá?"
- NUNCA invente preços, horários, procedimentos ou informações
- NUNCA diga "não fazemos" ou "não atendemos" — diga "vou verificar"
- Preços estão no conhecimento — use eles. Se não tiver o preço específico: "os valores variam, posso te passar certinho"
- IMPORTANTE: quando precisar da Myka (algo que vc não tem certeza ou não está no conhecimento acima), responda à cliente de forma natural ("vou confirmar com a Myka e já te falo, tá?") e acrescente NO FINAL da mensagem a tag literal [[ESCALAR]]. Essa tag é removida automaticamente antes de enviar — a cliente NUNCA vê. Use SÓ quando realmente precisar chamar a Myka.

AGENDAMENTO (quando pedirem):
- Pergunte: "Qual procedimento vc tá querendo?" e "Tem preferência de dia e horário?"
- Depois: "Vou olhar a agenda da Myka e te confirmo!"
- NÃO mencione site a menos que a pessoa insista em agendar sozinha

${config.extraInstructions ? `INSTRUÇÕES EXTRAS:\n${config.extraInstructions}\n` : ''}
NOME DO(A) PACIENTE: ${firstName}`

  const model = await createGeminiModel({
    model: config.model,
    systemInstruction: systemPrompt,
    temperature: 0.7,
    maxOutputTokens: 300,
    tenantId,
  })

  const prompt = history
    ? `Histórico da conversa:\n${history}\n\nMensagem do paciente: ${userMessage}\n\nResponda diretamente ao paciente:`
    : `Mensagem do paciente: ${userMessage}\n\nResponda diretamente ao paciente:`

  const result = await model.generateContent(prompt)
  return result.response.text() || ''
}

/**
 * Tenta responder via agente IA.
 * Retorna true se o agente respondeu, false se deve cair para o próximo handler.
 *
 * Fluxo: Bot Builder > AI Agent > Auto-Reply
 */
export async function tryAiAgentReply(params: {
  tenantId: string
  leadId: string
  leadName: string
  channelId: string
  remoteJid: string
  messageContent: string
}): Promise<boolean> {
  const { tenantId, leadId, leadName, channelId, remoteJid, messageContent } = params

  try {
    // 1. Buscar config do agente
    const config = await getAiAgentConfig(tenantId)
    if (!config) {
      console.error(`[ai-agent] SKIP lead=${leadId}: config não encontrada ou desabilitada`)
      return false
    }

    // 2. Verificar horário
    if (!isWithinSchedule(config)) {
      console.error(`[ai-agent] SKIP lead=${leadId}: fora do horário (schedule=${config.schedule})`)
      return false
    }

    // 2.1 Handoff: se um humano assumiu a conversa, a IA NÃO responde (bot pausado)
    const conv = await prisma.conversation.findUnique({
      where: { tenantId_remoteJid: { tenantId, remoteJid } },
      select: { id: true, assignedToUserId: true },
    })
    if (conv?.assignedToUserId) {
      console.error(`[ai-agent] SKIP-OK lead=${leadId}: conversa assumida por humano`)
      return true
    }

    // 2.5 Anti-loop: se IA respondeu há < 30s, ignorar (paciente mandando msgs em rajada)
    // NOTA: SKIPs intencionais retornam true para o response-guarantee NÃO disparar safety net
    const lastAiReply = await prisma.leadActivity.findFirst({
      where: { leadId, type: 'AI_AGENT_REPLY' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    })
    if (lastAiReply) {
      const elapsedMs = Date.now() - lastAiReply.createdAt.getTime()
      // Mensagem trivial (ok, sim, obrigado) → ignora se IA respondeu < 2 min
      if (isLoopMessage(messageContent) && elapsedMs < 120_000) {
        console.error(`[ai-agent] SKIP-OK lead=${leadId}: msg trivial "${messageContent}" (IA respondeu ${Math.round(elapsedMs/1000)}s atrás)`)
        return true // Skip intencional — lead JÁ foi respondido recentemente
      }
      // Qualquer mensagem → espera pelo menos 30s entre respostas (agrupa rajadas)
      if (elapsedMs < 30_000) {
        console.error(`[ai-agent] SKIP-OK lead=${leadId}: rajada (${Math.round(elapsedMs/1000)}s desde última resposta)`)
        return true // Skip intencional — lead JÁ foi respondido recentemente
      }
    }

    // 3. Verificar limite de interações
    const interactions = await countAiInteractions(leadId)
    if (interactions >= config.maxInteractions) {
      console.error(`[ai-agent] SKIP-LIMIT lead=${leadId}: maxInteractions atingido (${interactions}/${config.maxInteractions})`)
      // Só registra transferência uma vez
      const alreadyTransferred = await prisma.leadActivity.findFirst({
        where: { leadId, type: 'AI_AGENT_TRANSFERRED' },
        select: { id: true },
      })
      if (!alreadyTransferred) {
        await prisma.leadActivity.create({
          data: {
            leadId,
            type: 'AI_AGENT_TRANSFERRED',
            payload: {
              reason: 'max_interactions_reached',
              totalInteractions: interactions,
              transferredAt: new Date().toISOString(),
            },
          },
        })
      }
      return false // Cai para auto-reply ou safety net (lead precisa de humano)
    }

    // 4. Buscar histórico e gerar resposta
    const { history } = await getConversationHistory(tenantId, remoteJid, 8)

    const reply = await generateAgentReply({
      tenantId,
      leadName,
      config,
      history,
      userMessage: messageContent,
    })

    // Detecta pedido de escalonamento da IA e limpa a tag antes de enviar à cliente
    const needsHuman = /\[\[\s*escalar\s*\]\]/i.test(reply)
    const cleanReply = reply.replace(/\[\[\s*escalar\s*\]\]/gi, '').trim()
    if (!cleanReply) return false

    // 5. Buscar instanceId do canal
    const channel = await prisma.crmChannel.findUnique({
      where: { id: channelId },
      select: { instanceId: true },
    })
    if (!channel?.instanceId) return false

    // 6. Delay para parecer humano
    await new Promise(resolve => setTimeout(resolve, config.delayMs))

    // 7. Enviar via Evolution API
    const result = await evolutionApi.sendText(channel.instanceId, remoteJid, cleanReply)

    // A partir daqui, a mensagem JÁ FOI ENVIADA ao WhatsApp.
    // Erros de persistência NÃO devem retornar false (evita auto-reply duplicado).
    try {
      // 8. Salvar mensagem enviada no banco
      if (result?.key?.id) {
        const conversation = await prisma.conversation.findUnique({
          where: { tenantId_remoteJid: { tenantId, remoteJid } },
          select: { id: true },
        })

        if (conversation) {
          await prisma.message.create({
            data: {
              conversationId: conversation.id,
              tenantId,
              waMessageId: result.key.id,
              fromMe: true,
              type: 'TEXT',
              content: cleanReply,
              status: 'SENT',
              aiSummary: 'Resposta gerada pelo agente IA',
            },
          })
        }
      }

      // 9. Registrar atividade
      await prisma.leadActivity.create({
        data: {
          leadId,
          type: 'AI_AGENT_REPLY',
          payload: {
            message: cleanReply,
            model: config.model,
            interactionNumber: interactions + 1,
            sentAt: new Date().toISOString(),
          },
        },
      })
    } catch (saveErr) {
      // Mensagem já foi enviada — apenas logar erro de persistência
      console.error('[ai-agent] Mensagem enviada mas falha ao salvar no banco:', saveErr instanceof Error ? saveErr.message : saveErr)
    }

    // 10. Escalonamento — a IA não soube: avisa a Mykaele NA HORA + pausa o bot nessa conversa
    if (needsHuman) {
      try {
        // Atribui a conversa à Mykaele (admin) → IA/auto-reply/bot pulam a partir de agora
        const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } })
        if (conv?.id && admin?.id) {
          await prisma.conversation.update({ where: { id: conv.id }, data: { assignedToUserId: admin.id } })
        }
        await prisma.leadActivity.create({
          data: {
            leadId,
            type: 'AI_AGENT_TRANSFERRED',
            payload: { reason: 'nao_soube_responder', question: messageContent, at: new Date().toISOString() },
          },
        })
        const lead = await prisma.lead.findFirst({ where: { id: leadId }, select: { name: true, phone: true } })
        await sendHandoffNotification({
          leadName: lead?.name || leadName,
          leadPhone: lead?.phone,
          lastMessage: messageContent,
          agentName: config.agentName,
        })
        console.error(`[ai-agent] ESCALADO lead=${leadId}: Mykaele notificada (CallMeBot) + bot pausado`)
      } catch (escErr) {
        console.error('[ai-agent] Falha ao escalar pra Mykaele:', escErr instanceof Error ? escErr.message : escErr)
      }
    }

    return true
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack?.split('\n').slice(0, 3).join(' → ') : ''
    console.error(`[ai-agent] FALHA ao gerar resposta para lead=${params.leadId}: ${msg}`, stack ? `| Stack: ${stack}` : '')
    return false
  }
}
