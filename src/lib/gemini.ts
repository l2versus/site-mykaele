// src/lib/gemini.ts — Helper compartilhado para Gemini API key + model
// Busca a key de: 1) process.env  2) banco (CrmIntegration provider: 'ai-settings')
// Usado por: concierge, smart-replies, conversations/summary, rag.ts

import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai'
import { prisma } from '@/lib/prisma'

let _dbKeyCache: string | null = null
let _dbKeyCacheTime = 0
const DB_CACHE_TTL = 5 * 60_000 // 5 minutos

/**
 * Resolve a Gemini API key:
 * 1. process.env.GEMINI_API_KEY (mais rápido)
 * 2. CrmIntegration no banco (provider: 'ai-settings')
 */
export async function getGeminiApiKey(): Promise<string | null> {
  // 1. Env var — sempre preferido
  if (process.env.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY
  }

  // 2. Cache do DB (evita query a cada request)
  if (_dbKeyCache && Date.now() - _dbKeyCacheTime < DB_CACHE_TTL) {
    return _dbKeyCache
  }

  // 3. Banco de dados
  try {
    const tenantSlug = process.env.DEFAULT_TENANT_ID || 'clinica-mykaele-procopio'
    const tenant = await prisma.crmTenant.findUnique({ where: { slug: tenantSlug } })
    const tenantId = tenant?.id ?? tenantSlug

    const integration = await prisma.crmIntegration.findFirst({
      where: { tenantId, provider: 'ai-settings' },
    })
    const creds = integration?.credentials as Record<string, unknown> | null
    if (creds?.apiKey && typeof creds.apiKey === 'string' && !creds.apiKey.includes('*')) {
      _dbKeyCache = creds.apiKey
      _dbKeyCacheTime = Date.now()
      return _dbKeyCache
    }
  } catch (err) {
    console.error('[gemini] Falha ao buscar key do banco:', err instanceof Error ? err.message : err)
  }

  return null
}

/**
 * Cria um GenerativeModel do Gemini pronto para uso.
 * Resolve a API key automaticamente (env + DB fallback).
 */
export async function createGeminiModel(opts?: {
  model?: string
  systemInstruction?: string
  temperature?: number
  maxOutputTokens?: number
}): Promise<GenerativeModel> {
  const apiKey = await getGeminiApiKey()
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY não encontrada. Configure via variável de ambiente (Coolify) ou nas Configurações > IA do CRM.'
    )
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  return genAI.getGenerativeModel({
    model: opts?.model ?? 'gemini-2.0-flash',
    ...(opts?.systemInstruction ? { systemInstruction: opts.systemInstruction } : {}),
    generationConfig: {
      temperature: opts?.temperature ?? 0.7,
      maxOutputTokens: opts?.maxOutputTokens ?? 500,
    },
  })
}
