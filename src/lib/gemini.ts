// src/lib/gemini.ts — Provedor de IA unificado com cascade automático
// Ordem (grátis → pago): Gemini → Groq → OpenRouter → Together → OpenAI → Claude
// Quando um provedor falha (quota/erro), tenta o próximo automaticamente.
// Claude é sempre o ÚLTIMO para economizar tokens pagos.

import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai'
import { prisma } from '@/lib/prisma'

// ─── Tipos ─────────────────────────────────────────────────────
interface AiConfig {
  aiProvider: string
  apiKey: string
  model: string
  baseUrl: string
  cascadeEnabled: boolean
  geminiKey: string
  groqKey: string
  openrouterKey: string
  togetherKey: string
  openaiKey: string
  claudeKey: string
}

interface AiGenerateResult {
  text: () => string
}

interface AiModelWrapper {
  generateContent: (prompt: string) => Promise<{ response: AiGenerateResult }>
}

// ─── Constantes ────────────────────────────────────────────────
// Ordem fixa: grátis primeiro, pagos por último
const CASCADE_ORDER = ['gemini', 'groq', 'openrouter', 'together', 'openai', 'claude'] as const

const DEFAULT_CASCADE_MODELS: Record<string, string> = {
  gemini: 'gemini-2.0-flash',
  groq: 'llama-3.3-70b-versatile',
  openrouter: 'meta-llama/llama-3.1-8b-instruct:free',
  together: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
  openai: 'gpt-4o-mini',
  claude: 'claude-haiku-4-5-20251001',
}

const BASE_URLS: Record<string, string> = {
  groq: 'https://api.groq.com/openai/v1',
  openai: 'https://api.openai.com/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  together: 'https://api.together.xyz/v1',
  claude: 'https://api.anthropic.com',
}

// ─── Cache de config ───────────────────────────────────────────
let _configCache: AiConfig | null = null
let _configCacheTime = 0
const CONFIG_CACHE_TTL = 5 * 60_000

function readKeyFromCreds(creds: Record<string, unknown>, field: string): string {
  const val = creds[field]
  if (typeof val === 'string' && val.length > 4 && !val.includes('*')) return val
  return ''
}

export async function getAiConfig(): Promise<AiConfig | null> {
  if (_configCache && Date.now() - _configCacheTime < CONFIG_CACHE_TTL) {
    return _configCache
  }

  try {
    const tenantSlug = process.env.DEFAULT_TENANT_ID || 'clinica-mykaele-procopio'
    const tenant = await prisma.crmTenant.findUnique({ where: { slug: tenantSlug } })
    const tenantId = tenant?.id ?? tenantSlug

    const integration = await prisma.crmIntegration.findFirst({
      where: { tenantId, provider: 'ai-settings' },
    })
    const creds = integration?.credentials as Record<string, unknown> | null

    if (creds?.apiKey && typeof creds.apiKey === 'string' && !creds.apiKey.includes('*')) {
      const aiProvider = typeof creds.aiProvider === 'string' ? creds.aiProvider : 'gemini'

      _configCache = {
        aiProvider,
        apiKey: creds.apiKey,
        model: typeof creds.model === 'string' ? creds.model : 'gemini-2.0-flash',
        baseUrl: typeof creds.baseUrl === 'string' ? creds.baseUrl : '',
        cascadeEnabled: creds.cascadeEnabled === true,
        geminiKey: readKeyFromCreds(creds, 'geminiKey'),
        groqKey: readKeyFromCreds(creds, 'groqKey'),
        openrouterKey: readKeyFromCreds(creds, 'openrouterKey'),
        togetherKey: readKeyFromCreds(creds, 'togetherKey'),
        openaiKey: readKeyFromCreds(creds, 'openaiKey'),
        claudeKey: readKeyFromCreds(creds, 'claudeKey'),
      }

      // Sincronizar key do provedor primário no cascade
      if (_configCache.cascadeEnabled && _configCache.apiKey) {
        if (aiProvider === 'gemini' && !_configCache.geminiKey) _configCache.geminiKey = _configCache.apiKey
        else if (aiProvider === 'groq' && !_configCache.groqKey) _configCache.groqKey = _configCache.apiKey
        else if (aiProvider === 'openrouter' && !_configCache.openrouterKey) _configCache.openrouterKey = _configCache.apiKey
        else if (aiProvider === 'together' && !_configCache.togetherKey) _configCache.togetherKey = _configCache.apiKey
        else if (aiProvider === 'openai' && !_configCache.openaiKey) _configCache.openaiKey = _configCache.apiKey
        else if (aiProvider === 'claude' && !_configCache.claudeKey) _configCache.claudeKey = _configCache.apiKey
      }

      _configCacheTime = Date.now()
      return _configCache
    }
  } catch (err) {
    console.error('[ai] Falha ao buscar config do banco:', err instanceof Error ? err.message : err)
  }

  // Fallback: env vars
  if (process.env.GEMINI_API_KEY) {
    _configCache = {
      aiProvider: 'gemini', apiKey: process.env.GEMINI_API_KEY,
      model: 'gemini-2.0-flash', baseUrl: '',
      cascadeEnabled: false,
      geminiKey: process.env.GEMINI_API_KEY,
      groqKey: '', openrouterKey: '', togetherKey: '', openaiKey: '', claudeKey: '',
    }
    _configCacheTime = Date.now()
    return _configCache
  }

  return null
}

export function clearAiConfigCache() {
  _configCache = null
  _configCacheTime = 0
}

export async function getGeminiApiKey(): Promise<string | null> {
  const config = await getAiConfig()
  return config?.apiKey ?? null
}

// ─── Saúde dos provedores (in-memory) ──────────────────────────
const providerCooldowns = new Map<string, number>()
const COOLDOWN_MS = 5 * 60_000

function isProviderAvailable(provider: string): boolean {
  const cooldownEnd = providerCooldowns.get(provider)
  if (!cooldownEnd) return true
  if (Date.now() > cooldownEnd) {
    providerCooldowns.delete(provider)
    return true
  }
  return false
}

function markProviderDown(provider: string) {
  providerCooldowns.set(provider, Date.now() + COOLDOWN_MS)
  console.error(`[ai] ${provider} marcado como indisponível por 5 min`)
}

function isQuotaOrServerError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.includes('429') || msg.includes('quota') || msg.includes('rate-limit') ||
    msg.includes('Too Many Requests') || msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('overloaded')
}

// ─── Chamadas por provedor ─────────────────────────────────────

async function callGemini(
  apiKey: string, model: string, systemInstruction: string | undefined,
  prompt: string, temperature: number, maxTokens: number,
): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey)
  const geminiModel = genAI.getGenerativeModel({
    model,
    ...(systemInstruction ? { systemInstruction } : {}),
    generationConfig: { temperature, maxOutputTokens: maxTokens },
  })
  const result = await geminiModel.generateContent(prompt)
  return result.response.text() || ''
}

async function callOpenAiCompatible(
  baseUrl: string, apiKey: string, model: string,
  systemInstruction: string | undefined, prompt: string,
  temperature: number, maxTokens: number,
): Promise<string> {
  const messages: Array<{ role: string; content: string }> = []
  if (systemInstruction) messages.push({ role: 'system', content: systemInstruction })
  messages.push({ role: 'user', content: prompt })

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`AI API ${res.status}: ${err.slice(0, 200)}`)
  }

  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
  return data.choices?.[0]?.message?.content ?? ''
}

async function callAnthropic(
  apiKey: string, model: string, systemInstruction: string | undefined,
  prompt: string, temperature: number, maxTokens: number,
): Promise<string> {
  const body: Record<string, unknown> = {
    model, max_tokens: maxTokens, temperature,
    messages: [{ role: 'user', content: prompt }],
  }
  if (systemInstruction) body.system = systemInstruction

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`Claude API ${res.status}: ${err.slice(0, 200)}`)
  }

  const data = await res.json() as { content?: Array<{ type: string; text?: string }> }
  return data.content?.find(b => b.type === 'text')?.text ?? ''
}

async function callProvider(
  provider: string, apiKey: string, model: string,
  systemInstruction: string | undefined, prompt: string,
  temperature: number, maxTokens: number,
): Promise<string> {
  if (provider === 'gemini') {
    return callGemini(apiKey, model, systemInstruction, prompt, temperature, maxTokens)
  }
  if (provider === 'claude') {
    return callAnthropic(apiKey, model, systemInstruction, prompt, temperature, maxTokens)
  }
  // OpenAI-compatible (groq, openai, openrouter, together)
  const baseUrl = BASE_URLS[provider]
  if (!baseUrl) throw new Error(`Base URL não configurada para: ${provider}`)
  return callOpenAiCompatible(baseUrl, apiKey, model, systemInstruction, prompt, temperature, maxTokens)
}

// ─── createGeminiModel — ponto de entrada principal ────────────

export async function createGeminiModel(opts?: {
  model?: string
  systemInstruction?: string
  temperature?: number
  maxOutputTokens?: number
}): Promise<AiModelWrapper & GenerativeModel> {
  const config = await getAiConfig()
  if (!config) {
    throw new Error('Nenhum provedor de IA configurado. Acesse Configurações > IA no CRM.')
  }

  const temperature = opts?.temperature ?? 0.7
  const maxTokens = opts?.maxOutputTokens ?? 500
  const systemInstruction = opts?.systemInstruction

  type ProviderEntry = { name: string; key: string; model: string }
  const providers: ProviderEntry[] = []

  if (config.cascadeEnabled) {
    const keyMap: Record<string, string> = {
      gemini: config.geminiKey,
      groq: config.groqKey,
      openrouter: config.openrouterKey,
      together: config.togetherKey,
      openai: config.openaiKey,
      claude: config.claudeKey,
    }

    for (const name of CASCADE_ORDER) {
      const key = keyMap[name]
      if (key && isProviderAvailable(name)) {
        providers.push({
          name,
          key,
          model: name === config.aiProvider
            ? (opts?.model ?? config.model ?? DEFAULT_CASCADE_MODELS[name])
            : DEFAULT_CASCADE_MODELS[name],
        })
      }
    }
  }

  // Se cascade desabilitado ou nenhum provider no cascade, usar o primário
  if (providers.length === 0) {
    providers.push({
      name: config.aiProvider,
      key: config.apiKey,
      model: opts?.model ?? config.model,
    })
  }

  // Se só tem 1 provider e é Gemini sem cascade, retornar modelo nativo (perf)
  if (providers.length === 1 && providers[0].name === 'gemini' && !config.cascadeEnabled) {
    const genAI = new GoogleGenerativeAI(providers[0].key)
    return genAI.getGenerativeModel({
      model: providers[0].model,
      ...(systemInstruction ? { systemInstruction } : {}),
      generationConfig: { temperature, maxOutputTokens: maxTokens },
    })
  }

  // Wrapper com cascade automático
  const wrapper = {
    generateContent: async (prompt: string) => {
      let lastError: Error | null = null

      for (const p of providers) {
        try {
          const text = await callProvider(
            p.name, p.key, p.model,
            systemInstruction, prompt, temperature, maxTokens,
          )
          return { response: { text: () => text } }
        } catch (err) {
          lastError = err as Error
          const errMsg = lastError.message?.slice(0, 120) ?? 'erro desconhecido'

          if (isQuotaOrServerError(err)) {
            markProviderDown(p.name)
          }

          const idx = providers.indexOf(p)
          if (idx < providers.length - 1) {
            const next = providers[idx + 1]
            console.error(`[ai] ${p.name} falhou (${errMsg}), tentando ${next.name}...`)
            continue
          }

          console.error(`[ai] ${p.name} falhou (${errMsg}), sem mais provedores`)
        }
      }

      throw lastError || new Error('Todos os provedores de IA falharam.')
    },
  }

  return wrapper as AiModelWrapper & GenerativeModel
}
