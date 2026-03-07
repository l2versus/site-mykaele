'use client'

/**
 * Mapeia o nome do serviço (vindo do banco) para a imagem de fundo do ticket.
 * As imagens já contêm o design, logo e título do serviço embutidos.
 */
function getTicketBackground(serviceName: string): string {
  const name = serviceName.toLowerCase()
  if (name.includes('método') || name.includes('metodo') || name.includes('mykaele'))
    return '/tickets/ticket_MetoMyka.png'
  if (name.includes('relaxante'))
    return '/tickets/ticket_Relaxante.png'
  if (name.includes('relief'))
    return '/tickets/ticket_Relief.png'
  if (name.includes('ritual') || name.includes('sculpt'))
    return '/tickets/ticket_RitualSculpt.png'
  if (name.includes('wellness') || name.includes('welness'))
    return '/tickets/ticket_Welness.png'
  return '/tickets/ticket_Welness.png'
}

interface SessionTicketProps {
  serviceName: string
  remaining: number
  total: number
  expirationDate?: string
}

export function SessionTicket({ serviceName, remaining, total, expirationDate }: SessionTicketProps) {
  const bg = getTicketBackground(serviceName)
  const validUntil = expirationDate
    ? new Date(expirationDate).toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' })
    : 'Sem expiração'

  return (
    <div
      className="relative w-full rounded-2xl overflow-hidden shadow-lg shadow-black/30 group hover:scale-[1.02] transition-transform duration-300"
      style={{ aspectRatio: '16 / 7' }}
    >
      {/* Background ticket image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${bg})` }}
      />

      {/* Sutil vinheta inferior para legibilidade */}
      <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/60 to-transparent" />

      {/* Dados dinâmicos no rodapé */}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between px-5 pb-4">
        <span className="text-[#e8d5b7] text-xs sm:text-sm font-semibold drop-shadow-md tracking-wide">
          {remaining} / {total} {total === 1 ? 'sessão disponível' : 'sessões disponíveis'}
        </span>
        <span className="text-[#e8d5b7]/80 text-[10px] sm:text-xs font-medium drop-shadow-md">
          Válido até: {validUntil}
        </span>
      </div>
    </div>
  )
}
