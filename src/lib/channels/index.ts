// src/lib/channels/index.ts — Registry de provedores de canal
// Centraliza acesso a todos os provedores. Novos canais são registrados aqui.

import type { ChannelProvider, ChannelType } from './types'
import { whatsappProvider } from './whatsapp'

/** Mapa de provedores registrados */
const providers = new Map<ChannelType, ChannelProvider>()

// Registrar canais disponíveis
providers.set('whatsapp', whatsappProvider)

/**
 * Retorna o provedor de canal pelo tipo.
 * Lança erro se o canal não estiver registrado.
 */
export function getChannelProvider(type: ChannelType): ChannelProvider {
  const provider = providers.get(type)
  if (!provider) {
    throw new Error(`Canal "${type}" não está registrado. Canais disponíveis: ${Array.from(providers.keys()).join(', ')}`)
  }
  return provider
}

/**
 * Verifica se um provedor de canal está registrado.
 */
export function hasChannelProvider(type: ChannelType): boolean {
  return providers.has(type)
}

/**
 * Registra um novo provedor de canal.
 * Usado ao adicionar novos canais (Instagram, Facebook, Telegram, Email).
 */
export function registerChannelProvider(provider: ChannelProvider): void {
  providers.set(provider.type, provider)
}

/**
 * Lista todos os provedores registrados.
 */
export function listChannelProviders(): ChannelProvider[] {
  return Array.from(providers.values())
}

// Re-exportar tipos para conveniência
export type { ChannelProvider, ChannelType, SendMessageParams, SendMessageResult, ChannelStatus, IncomingMessage } from './types'
export { CHANNEL_CONFIG, CHANNEL_TYPES } from './types'
