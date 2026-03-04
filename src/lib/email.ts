// src/lib/email.ts — Envio de emails com Resend
import { Resend } from 'resend'

const FROM_EMAIL = 'Mykaele Procópio <contato@mykaprocopio.com.br>'
const FALLBACK_FROM = 'onboarding@resend.dev' // Usar enquanto domínio não verificado

// Lazy initialization - só instancia quando usado
let resendInstance: Resend | null = null
function getResend(): Resend {
  if (!resendInstance) {
    resendInstance = new Resend(process.env.RESEND_API_KEY)
  }
  return resendInstance
}

interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

export async function sendEmail({ to, subject, html, text }: EmailOptions) {
  // Se não tiver API key, apenas logar
  if (!process.env.RESEND_API_KEY) {
    console.log('[EMAIL] API Key não configurada. Email simulado:', { to, subject })
    return { success: true, simulated: true }
  }

  try {
    const from = process.env.RESEND_VERIFIED_DOMAIN ? FROM_EMAIL : FALLBACK_FROM
    const resend = getResend()

    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, '').substring(0, 500),
    })

    if (error) {
      console.error('[EMAIL] Erro ao enviar:', error)
      return { success: false, error: error.message }
    }

    console.log('[EMAIL] Enviado com sucesso:', data?.id)
    return { success: true, id: data?.id }
  } catch (err) {
    console.error('[EMAIL] Exceção:', err)
    return { success: false, error: String(err) }
  }
}

// Enviar email pós-sessão
export async function sendPostSessionEmail(data: {
  clientName: string
  clientEmail: string
  serviceName: string
  sessionDate: string
  measurements?: {
    waist?: { current: number; change: number }
    abdomen?: { current: number; change: number }
    hip?: { current: number; change: number }
    weight?: { current: number; change: number }
  }
  nextSteps?: string[]
  adminNotes?: string
}) {
  const formatDate = (d: string) => new Date(d).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  })

  const measurementRows = data.measurements ? Object.entries(data.measurements)
    .filter(([, v]) => v)
    .map(([key, v]) => {
      const labels: Record<string, string> = {
        waist: 'Cintura',
        abdomen: 'Abdômen',
        hip: 'Quadril',
        weight: 'Peso'
      }
      const unit = key === 'weight' ? 'kg' : 'cm'
      const changeColor = v!.change < 0 ? '#10b981' : v!.change > 0 ? '#f59e0b' : '#666'
      const changeSign = v!.change > 0 ? '+' : ''
      return `
        <tr>
          <td style="padding: 12px 16px; border-bottom: 1px solid #f0f0f0; color: #333;">${labels[key] || key}</td>
          <td style="padding: 12px 16px; border-bottom: 1px solid #f0f0f0; text-align: right; font-weight: 600; color: #333;">${v!.current}${unit}</td>
          <td style="padding: 12px 16px; border-bottom: 1px solid #f0f0f0; text-align: right; font-weight: 600; color: ${changeColor};">${changeSign}${v!.change}${unit}</td>
        </tr>
      `
    }).join('') : ''

  const careSteps = [
    { icon: '💧', title: 'Hidratação', desc: 'Beba 2L de água nas próximas 4 horas' },
    { icon: '☀️', title: 'Sol', desc: 'Evite exposição solar direta na área por 24h' },
    { icon: '🥗', title: 'Alimentação', desc: 'Prefira alimentos leves e anti-inflamatórios' },
    { icon: '🏃‍♀️', title: 'Exercícios', desc: 'Caminhadas leves potencializam os resultados' },
  ]

  const careHtml = careSteps.map(s => `
    <div style="display: flex; align-items: flex-start; margin-bottom: 12px;">
      <span style="font-size: 20px; margin-right: 12px;">${s.icon}</span>
      <div>
        <div style="font-weight: 600; color: #333; margin-bottom: 2px;">${s.title}</div>
        <div style="color: #666; font-size: 14px;">${s.desc}</div>
      </div>
    </div>
  `).join('')

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #b76e79 0%, #c28a93 100%); padding: 40px 30px; text-align: center;">
      <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 300;">Mykaele Procópio</h1>
      <p style="margin: 8px 0 0; color: rgba(255,255,255,0.85); font-size: 14px;">Home Spa | Arquitetura Corporal</p>
    </div>

    <!-- Content -->
    <div style="padding: 40px 30px;">
      <h2 style="margin: 0 0 8px; color: #b76e79; font-size: 22px; font-weight: 500;">Sessão Concluída! ✨</h2>
      <p style="margin: 0 0 24px; color: #666; font-size: 15px; line-height: 1.6;">
        Olá, <strong style="color: #333;">${data.clientName}</strong>!<br>
        Sua sessão de <strong style="color: #b76e79;">${data.serviceName}</strong> foi finalizada com sucesso.
      </p>

      <!-- Session Info -->
      <div style="background: #faf5f6; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <p style="margin: 0; color: #666; font-size: 13px;">📅 Data da sessão</p>
        <p style="margin: 4px 0 0; color: #333; font-size: 16px; font-weight: 500;">${formatDate(data.sessionDate)}</p>
      </div>

      ${data.measurements && measurementRows ? `
      <!-- Measurements -->
      <div style="margin-bottom: 32px;">
        <h3 style="margin: 0 0 16px; color: #333; font-size: 16px; font-weight: 600;">📊 Suas Medidas Atualizadas</h3>
        <table style="width: 100%; border-collapse: collapse; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
          <thead>
            <tr style="background: #b76e79;">
              <th style="padding: 12px 16px; text-align: left; color: white; font-weight: 500;">Medida</th>
              <th style="padding: 12px 16px; text-align: right; color: white; font-weight: 500;">Atual</th>
              <th style="padding: 12px 16px; text-align: right; color: white; font-weight: 500;">Variação</th>
            </tr>
          </thead>
          <tbody style="background: white;">
            ${measurementRows}
          </tbody>
        </table>
        <p style="margin: 12px 0 0; color: #10b981; font-size: 13px; text-align: center;">
          🎉 Continue assim! Seus resultados estão sendo registrados.
        </p>
      </div>
      ` : ''}

      <!-- Care Guidelines -->
      <div style="margin-bottom: 32px;">
        <h3 style="margin: 0 0 16px; color: #333; font-size: 16px; font-weight: 600;">💝 Cuidados Pós-Sessão</h3>
        <div style="background: #f8f8f8; border-radius: 12px; padding: 20px;">
          ${careHtml}
        </div>
      </div>

      ${data.adminNotes ? `
      <!-- Admin Notes -->
      <div style="margin-bottom: 32px;">
        <h3 style="margin: 0 0 12px; color: #333; font-size: 16px; font-weight: 600;">📝 Observações da Profissional</h3>
        <div style="background: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 0 8px 8px 0; padding: 16px;">
          <p style="margin: 0; color: #666; font-size: 14px; line-height: 1.6;">${data.adminNotes}</p>
        </div>
      </div>
      ` : ''}

      <!-- CTA -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="https://mykaprocopio.com.br/cliente/evolucao" 
           style="display: inline-block; background: linear-gradient(135deg, #b76e79 0%, #c28a93 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 30px; font-weight: 500; font-size: 15px;">
          Ver Minha Evolução Completa
        </a>
      </div>

      <!-- Next Session -->
      <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 12px; padding: 20px; text-align: center;">
        <p style="margin: 0 0 8px; color: #15803d; font-weight: 600;">Agende sua próxima sessão!</p>
        <p style="margin: 0 0 16px; color: #166534; font-size: 14px;">Mantenha a consistência para melhores resultados.</p>
        <a href="https://mykaprocopio.com.br/cliente/agendar" 
           style="display: inline-block; background: #15803d; color: white; text-decoration: none; padding: 10px 24px; border-radius: 20px; font-weight: 500; font-size: 14px;">
          Agendar Agora
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background: #333; padding: 30px; text-align: center;">
      <p style="margin: 0 0 8px; color: white; font-weight: 500;">Mykaele Procópio</p>
      <p style="margin: 0 0 16px; color: #999; font-size: 13px;">Home Spa | Arquitetura Corporal</p>
      <div style="margin-bottom: 16px;">
        <a href="https://wa.me/5585999086924" style="color: #25D366; text-decoration: none; font-size: 13px;">
          📱 WhatsApp: (85) 99908-6924
        </a>
      </div>
      <p style="margin: 0; color: #666; font-size: 11px;">
        Este email foi enviado automaticamente após sua sessão.<br>
        © ${new Date().getFullYear()} Mykaele Procópio. Todos os direitos reservados.
      </p>
    </div>
  </div>
</body>
</html>
  `

  return sendEmail({
    to: data.clientEmail,
    subject: `✨ Sessão Concluída - ${data.serviceName} | Mykaele Procópio`,
    html
  })
}

/**
 * Gera token de verificação seguro
 */
export function generateVerificationToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let token = ''
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return token
}

/**
 * Template de email de verificação - Design luxuoso
 */
export function getVerificationEmailTemplate(name: string, verificationUrl: string) {
  const firstName = name.split(' ')[0]
  
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirme seu email - Mykaele Procópio</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0e0b10; font-family: 'Helvetica Neue', Arial, sans-serif;">
  
  <!-- Container Principal -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0e0b10;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        
        <!-- Card do Email -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 520px; background: linear-gradient(135deg, #1a1520 0%, #0e0b10 100%); border-radius: 24px; overflow: hidden; border: 1px solid rgba(183, 110, 121, 0.15);">
          
          <!-- Banner Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #b76e79 0%, #c28a93 50%, #d4a0a7 100%); padding: 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding: 45px 30px 50px;">
                    <!-- Logo -->
                    <img src="https://mykaprocopio.com.br/media/logo-branding/logocorreta.png" alt="Mykaele Procópio" width="50" height="70" style="display: block; margin-bottom: 20px;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 300; letter-spacing: 1px; text-shadow: 0 2px 10px rgba(0,0,0,0.2);">
                      Mykaele Procópio
                    </h1>
                    <p style="margin: 8px 0 0; color: rgba(255,255,255,0.85); font-size: 10px; letter-spacing: 3px; text-transform: uppercase; font-weight: 500;">
                      Home Spa · Arquitetura Corporal
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Conteúdo -->
          <tr>
            <td style="padding: 40px 40px 45px;">
              
              <!-- Saudação -->
              <p style="margin: 0 0 25px; color: rgba(255,255,255,0.9); font-size: 18px; font-weight: 300; line-height: 1.6;">
                Olá, <strong style="color: #d4a0a7; font-weight: 500;">${firstName}</strong>! 🌸
              </p>
              
              <p style="margin: 0 0 30px; color: rgba(255,255,255,0.55); font-size: 15px; line-height: 1.7;">
                Que alegria ter você conosco! Para garantir sua segurança e acesso completo ao app, confirme seu email clicando no botão abaixo:
              </p>
              
              <!-- Botão CTA -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding: 10px 0 35px;">
                    <a href="${verificationUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #b76e79 0%, #c28a93 100%); color: #ffffff; text-decoration: none; padding: 16px 45px; border-radius: 50px; font-size: 14px; font-weight: 600; letter-spacing: 0.5px; box-shadow: 0 8px 25px rgba(183, 110, 121, 0.35);">
                      ✨ Confirmar meu email
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Divider -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding: 15px 0;">
                    <div style="height: 1px; background: linear-gradient(90deg, transparent, rgba(183, 110, 121, 0.2), transparent);"></div>
                  </td>
                </tr>
              </table>
              
              <!-- Benefícios -->
              <p style="margin: 20px 0 15px; color: rgba(255,255,255,0.4); font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">
                Com sua conta você pode
              </p>
              
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin-bottom: 25px;">
                <tr>
                  <td style="padding: 8px 0;">
                    <span style="color: #b76e79; font-size: 14px;">✦</span>
                    <span style="color: rgba(255,255,255,0.6); font-size: 13px; margin-left: 10px;">Agendar sessões 24h pelo app</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;">
                    <span style="color: #b76e79; font-size: 14px;">✦</span>
                    <span style="color: rgba(255,255,255,0.6); font-size: 13px; margin-left: 10px;">Acompanhar sua evolução corporal</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;">
                    <span style="color: #b76e79; font-size: 14px;">✦</span>
                    <span style="color: rgba(255,255,255,0.6); font-size: 13px; margin-left: 10px;">Acumular pontos e subir de Tier VIP</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;">
                    <span style="color: #b76e79; font-size: 14px;">✦</span>
                    <span style="color: rgba(255,255,255,0.6); font-size: 13px; margin-left: 10px;">Indicar amigas e ganhar descontos</span>
                  </td>
                </tr>
              </table>
              
              <!-- Link alternativo -->
              <p style="margin: 25px 0 0; color: rgba(255,255,255,0.3); font-size: 11px; line-height: 1.6;">
                Se o botão não funcionar, copie e cole este link no navegador:<br>
                <a href="${verificationUrl}" style="color: #b76e79; word-break: break-all; font-size: 10px;">${verificationUrl}</a>
              </p>
              
              <p style="margin: 20px 0 0; color: rgba(255,255,255,0.25); font-size: 10px;">
                Este link expira em 24 horas.
              </p>
              
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: rgba(0,0,0,0.2); padding: 25px 40px; border-top: 1px solid rgba(183, 110, 121, 0.1);">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <p style="margin: 0 0 8px; color: rgba(255,255,255,0.35); font-size: 11px;">
                      Com carinho,
                    </p>
                    <p style="margin: 0 0 15px; color: #d4a0a7; font-size: 14px; font-weight: 500;">
                      Mykaele Procópio 💕
                    </p>
                    <p style="margin: 0; color: rgba(255,255,255,0.2); font-size: 9px; letter-spacing: 1px;">
                      © ${new Date().getFullYear()} Mykaele Procópio Home Spa · Fortaleza, CE
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
        </table>
        
        <!-- Unsubscribe -->
        <p style="margin: 25px 0 0; color: rgba(255,255,255,0.15); font-size: 9px; text-align: center;">
          Você recebeu este email porque se cadastrou em mykaprocopio.com.br<br>
          Se não foi você, ignore este email.
        </p>
        
      </td>
    </tr>
  </table>
  
</body>
</html>
`
}

/**
 * Envia email de verificação
 */
export async function sendVerificationEmail(email: string, name: string, token: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://mykaprocopio.com.br'
  const verificationUrl = `${baseUrl}/api/auth/verify-email?token=${token}`
  
  const html = getVerificationEmailTemplate(name, verificationUrl)
  
  return sendEmail({
    to: email,
    subject: '🌸 Confirme seu email - Mykaele Procópio Home Spa',
    html
  })
}
