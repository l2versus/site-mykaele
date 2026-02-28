# 🤖 Integração WhatsApp - Guia de Implementação

## Visão Geral

A integração WhatsApp automatiza:
- **Lembretes 48h antes** do agendamento
- **Lembretes 24h antes** do agendamento  
- **Lembretes 2h antes** do agendamento
- **Confirmação via botão** (em vez de texto)
- **Reagendamento automático** do agenda da clínica
- **Notificações de resultado** após procedimento

---

## Opção A: Evolution API (Recomendado)

### 1. Setup da Evolution API

```bash
# Registrar em https://api.evolutionapi.com
# Criar instância do WhatsApp Business
# Obter credenciais:
# - API_KEY
# - INSTANCE_ID
# - WEBHOOK_URL
```

### 2. Atualizar `.env.local`

```env
WHATSAPP_API_URL=https://api.evolutionapi.com
WHATSAPP_API_KEY=sua-chave-aqui
WHATSAPP_INSTANCE_ID=sua-instancia-id
WEBHOOK_SECRET=seu-secret-para-validar-webhooks
```

### 3. Criar API Route para Webhooks

```typescript
// app/api/whatsapp/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Evolution API envia eventos aqui
    // Tipos de eventos: message.upsert, buttons.upsert, etc

    if (body.event === 'messages.upsert') {
      const message = body.data
      const phoneNumber = message.key.remoteJid

      // Procurar paciente pelo número de telefone
      const patient = await prisma.patientProfile.findFirst({
        where: {
          user: {
            phone: phoneNumber.replace('@s.whatsapp.net', ''),
          },
        },
        include: { user: true },
      })

      if (!patient) return NextResponse.json({ ok: true })

      // Processar resposta do paciente
      if (message.message?.buttonsResponseMessage) {
        const buttonId = message.message.buttonsResponseMessage.selectedButtonId
        
        // Se clicou em "Confirmar"
        if (buttonId === 'btn_confirm') {
          // Atualizar status do agendamento
          const appointment = await prisma.appointment.findFirst({
            where: {
              patientId: patient.userId,
              status: 'PENDING',
            },
            orderBy: { scheduledAt: 'asc' },
          })

          if (appointment) {
            await prisma.appointment.update({
              where: { id: appointment.id },
              data: {
                status: 'CONFIRMED',
                whatsappConfirmed: true,
                whatsappConfirmedAt: new Date(),
              },
            })

            // Enviar mensagem de confirmação
            await sendWhatsAppMessage(
              phoneNumber,
              `✅ Sua consulta foi confirmada!\\n${appointment.service} em ${appointment.scheduledAt}`
            )
          }
        }
        
        // Se clicou em "Reagendar"
        if (buttonId === 'btn_reschedule') {
          await sendWhatsAppMessage(
            phoneNumber,
            `Para reagendar, acesse: https://sua-url.com/agendamento?consultation=${appointment?.id}`
          )
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro no webhook:', error)
    return NextResponse.json({ error: 'Erro ao processar' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  // Validação do webhook (Evolution API)
  const token = request.nextUrl.searchParams.get('hub.verify_token')
  const challenge = request.nextUrl.searchParams.get('hub.challenge')

  if (token === process.env.WEBHOOK_SECRET) {
    return new NextResponse(challenge)
  }

  return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
}
```

### 4. Função para Enviar Mensagens

```typescript
// src/utils/whatsapp.ts
export async function sendWhatsAppMessage(
  phoneNumber: string,
  message: string,
  buttons?: Array<{ id: string; title: string }>
) {
  const url = `${process.env.WHATSAPP_API_URL}/message/sendText`

  const payload: any = {
    number: phoneNumber,
    text: message,
  }

  if (buttons) {
    payload.buttons = buttons.map((btn, i) => ({
      buttonId: btn.id,
      buttonText: btn.title,
      type: 'replyButton',
    }))
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'ApiKey': process.env.WHATSAPP_API_KEY!,
      'Instance': process.env.WHATSAPP_INSTANCE_ID!,
    },
    body: JSON.stringify(payload),
  })

  return response.json()
}

// Envio com botões de confirmação
export async function sendAppointmentReminder(
  patientPhone: string,
  appointmentDate: Date,
  service: string
) {
  const formattedDate = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(appointmentDate)

  const message = `Olá! 👋\n\nLembrando que você tem um agendamento marcado:\n\n📅 ${service}\n⏰ ${formattedDate}\n\nConfirme sua presença:`

  await sendWhatsAppMessage(patientPhone, message, [
    { id: 'btn_confirm', title: '✓ Confirmar' },
    { id: 'btn_reschedule', title: '📅 Reagendar' },
  ])
}
```

---

## Opção B: Z-API (Alternativa)

### Setup Z-API

```env
ZAPI_CLIENT_TOKEN=seu-token
ZAPI_CLIENT_ID=seu-id
```

```typescript
const sendViaZAPI = async (phone: string, message: string) => {
  const response = await fetch('https://api.z-api.io/instances/YOUR_INSTANCE/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'client-token': process.env.ZAPI_CLIENT_TOKEN,
    },
    body: JSON.stringify({
      phone: phone,
      message: message,
    }),
  })
  return response.json()
}
```

---

## 🕐 Cronjobs para Lembretes Automáticos

```typescript
// src/cron/appointment-reminders.ts
import cron from 'node-cron'
import { prisma } from '@/lib/prisma'
import { sendAppointmentReminder } from '@/utils/whatsapp'
import { addHours } from 'date-fns'

export function startAppointmentReminders() {
  // Executar a cada hora
  cron.schedule('0 * * * *', async () => {
    const now = new Date()

    // Buscar lembretes pendentes
    const reminders = await prisma.appointmentReminder.findMany({
      where: {
        sent: false,
        reminderAt: {
          lte: now,
        },
      },
      include: {
        appointment: {
          include: {
            patient: true,
          },
        },
      },
    })

    for (const reminder of reminders) {
      try {
        const patient = reminder.appointment.patient

        if (patient.phone) {
          await sendAppointmentReminder(
            patient.phone,
            reminder.appointment.scheduledAt,
            reminder.appointment.service
          )

          await prisma.appointmentReminder.update({
            where: { id: reminder.id },
            data: {
              sent: true,
              sentAt: new Date(),
            },
          })
        }
      } catch (error) {
        console.error(`Erro ao enviar lembrete ${reminder.id}:`, error)
      }
    }
  })

  console.log('✅ Cronjob de lembretes iniciado')
}
```

### Integrar no `server.ts` ou startup

```typescript
// app/api/cron/start/route.ts
import { startAppointmentReminders } from '@/cron/appointment-reminders'

export async function GET() {
  startAppointmentReminders()
  return Response.json({ message: 'Crons started' })
}
```

---

## 📊 Status de Agendamento No WhatsApp

```
Paciente clica em [✓ Confirmar]
         ↓
Webhook recebe event (messages.upsert)
         ↓
API processa buttonId='btn_confirm'
         ↓
Atualiza appointment.status = 'CONFIRMED'
         ↓
Log criado em SystemLog
         ↓
Dashboard admin mostra agenda em VERDE
         ↓
Mensagem de confirmação enviada ao paciente
```

---

## 🔐 Segurança

1. **Validar webhooks** com token secreto
2. **Rate limiting** nas rotas (evitar spam)
3. **Encriptar** números de telefone no BD
4. **Usar HTTPS** em produção
5. **Logs auditoria** em SystemLog para cada ação

```typescript
// Middleware para validar webhooks
export async function validateWebhookSignature(
  data: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const crypto = require('crypto')
  const hash = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('hex')
  return hash === signature
}
```

---

## 🧪 Teste Local

```bash
# Usar ngrok para expor localhost
ngrok http 3000

# Copiar URL do ngrok
WEBHOOK_URL=https://xxxx-ngrok-url.com/api/whatsapp/webhook

# Configurar na Evolution/Z-API
# Testar com curl
curl -X POST http://localhost:3000/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{"event":"messages.upsert","data":{...}}'
```

---

## 📱 Próximas Integrações

- [ ] Status de entrega (enviado ✓, recebido ✓✓, lido ✓✓✓)
- [ ] Notificações de resultado pós-procedimento
- [ ] Vendas cruzadas via WhatsApp
- [ ] Formulários via WhatsApp (confirmar alergias, etc)
- [ ] Pagamento integrado no WhatsApp

---

**Desenvolvido com ❤️ para maximizar a conversão e confirmação de agendamentos**
