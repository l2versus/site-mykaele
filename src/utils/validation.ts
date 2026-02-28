// src/utils/validation.ts
import { z } from 'zod'

// Validação de email
export const emailSchema = z.string().email('Email inválido')

// Validação de senha
export const passwordSchema = z
  .string()
  .min(6, 'Senha deve ter no mínimo 6 caracteres')

// Validação de cadastro
export const registerSchema = z.object({
  name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Senhas não conferem',
  path: ['confirmPassword'],
})

// Validação de agendamento
export const appointmentSchema = z.object({
  patientId: z.string(),
  professionalId: z.string(),
  clinicId: z.string(),
  roomId: z.string(),
  equipmentId: z.string().optional(),
  service: z.string().min(1, 'Serviço é obrigatório'),
  scheduledAt: z.date(),
  duration: z.number().min(30, 'Duração mínima é 30 minutos'),
  notes: z.string().optional(),
})

// Validação de pagamento
export const paymentSchema = z.object({
  patientId: z.string(),
  amount: z.number().positive('Valor deve ser positivo'),
  paymentMethod: z.enum(['cartao_credito', 'cartao_debito', 'pix', 'boleto']),
  description: z.string().optional(),
})

// Validação de CPF (simplificada)
export const cpfSchema = z
  .string()
  .regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, 'CPF inválido (formato: XXX.XXX.XXX-XX)')
  .or(z.string().regex(/^\d{11}$/, 'CPF inválido'))
