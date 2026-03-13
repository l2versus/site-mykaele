// src/lib/ai-agent.ts — Agente Recepcionista IA
// Responde automaticamente no WhatsApp usando RAG + Gemini.
// Prioridade no webhook: Bot Builder > AI Agent > Auto-Reply
// Config armazenada em CrmIntegration (provider: 'ai-agent').
// Rastreio via LeadActivity (type: 'AI_AGENT_REPLY').

import { prisma } from '@/lib/prisma'
import { evolutionApi } from '@/lib/evolution-api'
import { findSimilarChunks } from '@/lib/rag'
import { GoogleGenerativeAI } from '@google/generative-ai'

interface AiAgentConfig {
  enabled: boolean
  agentName: string
  tone: 'formal' | 'informal' | 'carinhoso' | 'profissional'
  extraInstructions: string
  maxInteractions: number
  schedule: 'always' | 'outside_hours'
  businessHoursStart: string // "08:00"
  businessHoursEnd: string   // "18:00"
  model: 'gemini-2.0-flash' | 'gemini-1.5-pro'
  delayMs: number
}

const DEFAULT_CONFIG: AiAgentConfig = {
  enabled: false,
  agentName: 'Assistente Myka',
  tone: 'profissional',
  extraInstructions: '',
  maxInteractions: 10,
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

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada')

  // Buscar contexto relevante da base de conhecimento
  const chunks = await findSimilarChunks(tenantId, userMessage, 4, 0.5)
  const context = chunks.map(c => c.content).join('\n\n---\n\n')

  const firstName = leadName.split(' ')[0] || 'cliente'
  const toneDesc = TONE_DESCRIPTIONS[config.tone] ?? TONE_DESCRIPTIONS.profissional

  const systemPrompt = `Você é ${config.agentName}, assistente virtual da Clínica Mykaele Procópio, uma clínica de estética de luxo em Fortaleza.

PERSONA:
- Seu nome é ${config.agentName}
- Seja ${toneDesc}
- Responda em português brasileiro natural
- Respostas curtas e objetivas (máximo 2-3 parágrafos, ideal 1-2 frases)
- Use emojis com moderação (máximo 1-2 por mensagem)

REGRAS IMPORTANTES:
- NUNCA invente informações sobre procedimentos, preços ou horários
- Use APENAS o contexto da base de conhecimento fornecido abaixo
- Se não souber a resposta, diga educadamente que vai encaminhar para a equipe
- Sempre tente direcionar para um agendamento quando apropriado
- NÃO repita informações que já foram ditas na conversa
- NÃO se apresente novamente se já se apresentou antes no histórico

${config.extraInstructions ? `INSTRUÇÕES ADICIONAIS:\n${config.extraInstructions}\n` : ''}
CONTEXTO DA BASE DE CONHECIMENTO:
${context || 'Nenhum contexto específico encontrado.'}

NOME DO PACIENTE: ${firstName}`

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: config.model,
    systemInstruction: systemPrompt,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 300,
    },
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
    if (!config) return false

    // 2. Verificar horário
    if (!isWithinSchedule(config)) return false

    // 3. Verificar limite de interações
    const interactions = await countAiInteractions(leadId)
    if (interactions >= config.maxInteractions) {
      // Transferir para humano: marcar como transferido
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
      return false // Cai para auto-reply ou humano
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

    if (!reply.trim()) return false

    // 5. Buscar instanceId do canal
    const channel = await prisma.crmChannel.findUnique({
      where: { id: channelId },
      select: { instanceId: true },
    })
    if (!channel?.instanceId) return false

    // 6. Delay para parecer humano
    await new Promise(resolve => setTimeout(resolve, config.delayMs))

    // 7. Enviar via Evolution API
    const result = await evolutionApi.sendText(channel.instanceId, remoteJid, reply)

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
            content: reply,
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
          message: reply,
          model: config.model,
          interactionNumber: interactions + 1,
          sentAt: new Date().toISOString(),
        },
      },
    })

    return true
  } catch (err) {
    console.error('[ai-agent] Erro ao gerar resposta:', err instanceof Error ? err.message : err)
    return false
  }
}
