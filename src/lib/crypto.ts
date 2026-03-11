// src/lib/crypto.ts — Criptografia AES-256-GCM para credenciais CRM
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY inválida — gere com: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"')
  }
  return Buffer.from(hex, 'hex')
}

export function encryptCredentials(data: Record<string, unknown>): string {
  const key = getKey()
  const iv = randomBytes(16)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const json = JSON.stringify(data)
  const encrypted = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':')
}

export function decryptCredentials(ciphertext: string): Record<string, unknown> {
  const key = getKey()
  const parts = ciphertext.split(':')
  if (parts.length !== 3) {
    throw new Error('Formato de ciphertext inválido')
  }
  const [ivHex, authTagHex, dataHex] = parts
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ])
  return JSON.parse(decrypted.toString('utf8'))
}
