/**
 * Datas comemorativas brasileiras relevantes para negócio de estética/spa.
 * Cada data tem: dia, mês, nome, emoji, e dica de ação de marketing.
 *
 * Inclui datas "comerciais" importantes + saúde/beleza + feriados nacionais.
 */
export interface DataComemorativa {
  day: number
  month: number // 1-indexed (Janeiro=1)
  name: string
  emoji: string
  /** Dica rápida de ação/promoção para o spa */
  dica: string
  /** Categorias: marketing, feriado, saúde, beleza, social */
  categoria: 'marketing' | 'feriado' | 'saude' | 'beleza' | 'social'
}

export const datasGerais: DataComemorativa[] = [
  // ── Janeiro ──
  { day: 1, month: 1, name: 'Ano Novo', emoji: '🎆', dica: 'Post "Ano Novo, Pele Nova" — promoção de janeiro', categoria: 'feriado' },
  { day: 20, month: 1, name: 'Dia do Farmacêutico', emoji: '💊', dica: 'Parceria com farmácias — dermocosméticos', categoria: 'saude' },
  { day: 30, month: 1, name: 'Dia da Saudade', emoji: '💕', dica: 'Reativar clientes sumidas — "Sentimos sua falta"', categoria: 'marketing' },

  // ── Fevereiro ──
  { day: 14, month: 2, name: 'Valentine\'s Day (Internacional)', emoji: '💝', dica: 'Promoção para casais ou presente para parceiro(a)', categoria: 'marketing' },
  { day: 17, month: 2, name: 'Dia dos Esportistas', emoji: '🏃‍♀️', dica: 'Post sobre cuidados com a pele pós-exercício', categoria: 'saude' },

  // ── Março ──
  { day: 8, month: 3, name: 'Dia Internacional da Mulher', emoji: '👩', dica: 'MEGA promoção — pacotes especiais, mimo para clientes', categoria: 'marketing' },
  { day: 15, month: 3, name: 'Dia do Consumidor', emoji: '🛍️', dica: 'Super desconto relâmpago em pacotes', categoria: 'marketing' },
  { day: 20, month: 3, name: 'Início do Outono', emoji: '🍂', dica: 'Divulgar tratamentos de recuperação pós-verão', categoria: 'beleza' },
  { day: 22, month: 3, name: 'Dia Mundial da Água', emoji: '💧', dica: 'Post sobre hidratação da pele', categoria: 'saude' },
  { day: 26, month: 3, name: 'Dia do Cacau', emoji: '🍫', dica: 'Tratamento com chocolate — marketing criativo', categoria: 'beleza' },

  // ── Abril ──
  { day: 7, month: 4, name: 'Dia Mundial da Saúde', emoji: '🏥', dica: 'Post sobre saúde da pele + checkup dermatológico', categoria: 'saude' },
  { day: 8, month: 4, name: 'Dia da Dermatologia', emoji: '🧴', dica: 'Valorizar cuidados profissionais com a pele', categoria: 'beleza' },
  { day: 15, month: 4, name: 'Dia da Conservação do Solo', emoji: '🌿', dica: 'Post sobre sustentabilidade e cosméticos naturais', categoria: 'social' },
  { day: 21, month: 4, name: 'Tiradentes', emoji: '🇧🇷', dica: 'Feriado — avaliar horários especiais', categoria: 'feriado' },
  { day: 22, month: 4, name: 'Dia da Terra', emoji: '🌍', dica: 'Post sobre produtos eco-friendly e sustentáveis', categoria: 'social' },
  { day: 25, month: 4, name: 'Dia da Contabilidade', emoji: '📊', dica: 'Revisar finanças do trimestre', categoria: 'social' },
  { day: 28, month: 4, name: 'Dia da Educação', emoji: '📚', dica: 'Stories educativos sobre pele e autocuidado', categoria: 'social' },

  // ── Maio ──
  { day: 1, month: 5, name: 'Dia do Trabalho', emoji: '👷', dica: 'Feriado — promoção "Você merece descansar"', categoria: 'feriado' },
  { day: 10, month: 5, name: 'Dia das Mães', emoji: '👩‍👧', dica: '⭐ DATA TOP — Gift cards, pacotes mãe+filha, promoções', categoria: 'marketing' },
  { day: 15, month: 5, name: 'Dia da Família', emoji: '👨‍👩‍👧‍👦', dica: 'Pacote família com desconto', categoria: 'marketing' },
  { day: 25, month: 5, name: 'Dia da Indústria', emoji: '🏭', dica: 'Post sobre tecnologia nos tratamentos estéticos', categoria: 'social' },
  { day: 27, month: 5, name: 'Dia da Mata Atlântica', emoji: '🌳', dica: 'Post sobre ingredientes naturais brasileiros', categoria: 'social' },

  // ── Junho ──
  { day: 5, month: 6, name: 'Dia do Meio Ambiente', emoji: '♻️', dica: 'Post sustentabilidade + embalagens recicláveis', categoria: 'social' },
  { day: 12, month: 6, name: 'Dia dos Namorados 🇧🇷', emoji: '❤️', dica: '⭐ DATA TOP — Pacotes casal, presente para namorada(o)', categoria: 'marketing' },
  { day: 20, month: 6, name: 'Início do Inverno', emoji: '❄️', dica: 'Lançar tratamentos de inverno — peeling, laser', categoria: 'beleza' },
  { day: 24, month: 6, name: 'São João', emoji: '🔥', dica: 'Feriado em muitas cidades — horários especiais', categoria: 'feriado' },

  // ── Julho ──
  { day: 8, month: 7, name: 'Dia da Ciência', emoji: '🔬', dica: 'Post sobre ciência por trás dos tratamentos', categoria: 'saude' },
  { day: 13, month: 7, name: 'Dia do Cantor', emoji: '🎤', dica: 'Parceria com influenciadora/cantora local', categoria: 'marketing' },
  { day: 17, month: 7, name: 'Dia da Proteção às Florestas', emoji: '🌲', dica: 'Post sobre cosméticos veganos/naturais', categoria: 'social' },
  { day: 20, month: 7, name: 'Dia do Amigo', emoji: '🤝', dica: '⭐ Promoção "Traga uma amiga" — desconto duplo', categoria: 'marketing' },
  { day: 25, month: 7, name: 'Dia do Escritor', emoji: '✍️', dica: 'Publicar depoimentos de clientes satisfeitas', categoria: 'marketing' },
  { day: 26, month: 7, name: 'Dia dos Avós', emoji: '👵', dica: 'Promoção especial para avós — tratamento rejuvenescedor', categoria: 'marketing' },

  // ── Agosto ──
  { day: 5, month: 8, name: 'Dia Nacional da Saúde', emoji: '💚', dica: 'Post sobre saúde + estética — cuidar de dentro pra fora', categoria: 'saude' },
  { day: 10, month: 8, name: 'Dia dos Pais', emoji: '👨', dica: 'Gift cards para pais — tratamento facial masculino', categoria: 'marketing' },
  { day: 11, month: 8, name: 'Dia do Estudante', emoji: '🎓', dica: 'Promoção universitária — desconto especial', categoria: 'marketing' },
  { day: 15, month: 8, name: 'Dia da Informática', emoji: '💻', dica: 'Divulgar app/site e facilidades digitais do spa', categoria: 'social' },
  { day: 22, month: 8, name: 'Dia do Folclore', emoji: '🎭', dica: 'Post divertido sobre "segredos de beleza brasileiros"', categoria: 'social' },
  { day: 25, month: 8, name: 'Dia da Modelo/Manequim', emoji: '💃', dica: 'Post sobre autoestima + cuidados profissionais', categoria: 'beleza' },

  // ── Setembro ──
  { day: 1, month: 9, name: 'Dia do Profissional de Educação Física', emoji: '💪', dica: 'Parceria com personal trainers', categoria: 'saude' },
  { day: 5, month: 9, name: 'Dia da Amazônia', emoji: '🌿', dica: 'Post sobre ingredientes amazônicos (açaí, cupuaçu)', categoria: 'beleza' },
  { day: 7, month: 9, name: 'Independência do Brasil', emoji: '🇧🇷', dica: 'Feriado — horários especiais ou promoção patriótica', categoria: 'feriado' },
  { day: 15, month: 9, name: 'Dia do Cliente', emoji: '👑', dica: '⭐ DATA TOP — Desconto exclusivo para clientes fiéis', categoria: 'marketing' },
  { day: 20, month: 9, name: 'Dia da Revolução Farroupilha', emoji: '🧉', dica: 'Se tiver clientes do Sul — homenagem gaúcha', categoria: 'social' },
  { day: 21, month: 9, name: 'Dia da Árvore', emoji: '🌳', dica: 'Post sobre natureza + ingredientes botânicos', categoria: 'social' },
  { day: 22, month: 9, name: 'Início da Primavera', emoji: '🌸', dica: '⭐ Lançar promoções de primavera/verão — preparar pele', categoria: 'beleza' },
  { day: 23, month: 9, name: 'Dia do Sorvete', emoji: '🍦', dica: 'Post divertido "tratamento refrescante"', categoria: 'marketing' },

  // ── Outubro ──
  { day: 1, month: 10, name: 'Outubro Rosa', emoji: '🎀', dica: '⭐ Campanha o mês todo — autoestima + saúde da mulher', categoria: 'saude' },
  { day: 12, month: 10, name: 'Dia das Crianças / N.S. Aparecida', emoji: '👧', dica: 'Feriado — "Dia de princesa" para mães e filhas', categoria: 'feriado' },
  { day: 15, month: 10, name: 'Dia do Professor', emoji: '📖', dica: 'Promoção especial para professoras', categoria: 'marketing' },
  { day: 18, month: 10, name: 'Dia do Médico', emoji: '👨‍⚕️', dica: 'Post sobre parceria estética + dermatologia', categoria: 'saude' },
  { day: 25, month: 10, name: 'Dia da Saúde Dentária', emoji: '🦷', dica: 'Post sobre harmonia facial (dentes + pele)', categoria: 'saude' },
  { day: 29, month: 10, name: 'Dia Nacional do Livro', emoji: '📚', dica: 'Indicar livro de autocuidado/bem-estar', categoria: 'social' },
  { day: 31, month: 10, name: 'Halloween', emoji: '🎃', dica: 'Post divertido "Skincare de bruxa" — promoção temática', categoria: 'marketing' },

  // ── Novembro ──
  { day: 1, month: 11, name: 'Novembro Azul / Dia de Todos os Santos', emoji: '💙', dica: 'Saúde masculina + tratamentos para o público masculino', categoria: 'saude' },
  { day: 2, month: 11, name: 'Finados', emoji: '🕊️', dica: 'Feriado — respeitar e não postar promoções', categoria: 'feriado' },
  { day: 12, month: 11, name: 'Dia da Pele', emoji: '✨', dica: '⭐ DATA TOP — Dia perfeito para promover todos os serviços!', categoria: 'beleza' },
  { day: 15, month: 11, name: 'Proclamação da República', emoji: '🇧🇷', dica: 'Feriado — avaliar horários especiais', categoria: 'feriado' },
  { day: 19, month: 11, name: 'Dia da Bandeira', emoji: '🇧🇷', dica: 'Post patriótico "beleza brasileira"', categoria: 'social' },
  { day: 20, month: 11, name: 'Dia da Consciência Negra', emoji: '✊🏿', dica: 'Inclusão + diversidade — todos os tipos de pele', categoria: 'social' },
  { day: 25, month: 11, name: 'Dia do Doador Voluntário de Sangue', emoji: '🩸', dica: 'Post solidário — cuidar dos outros', categoria: 'social' },
  { day: 28, month: 11, name: 'Black Friday', emoji: '🏷️', dica: '⭐ DATA TOP — Mega promoção em pacotes e tratamentos', categoria: 'marketing' },

  // ── Dezembro ──
  { day: 1, month: 12, name: 'Dia do Imigrante', emoji: '🌎', dica: 'Valorizar diversidade de clientes', categoria: 'social' },
  { day: 4, month: 12, name: 'Dia da Propaganda', emoji: '📢', dica: 'Revisar estratégia de marketing do ano', categoria: 'marketing' },
  { day: 8, month: 12, name: 'Dia da Família', emoji: '👨‍👩‍👧', dica: 'Pacote família para o fim de ano', categoria: 'marketing' },
  { day: 11, month: 12, name: 'Dia do Engenheiro', emoji: '👷', dica: 'Promoção para esposas/maridos de engenheiros', categoria: 'social' },
  { day: 14, month: 12, name: 'Dia do Costureiro', emoji: '🧵', dica: 'Post sobre parceria moda + estética', categoria: 'social' },
  { day: 20, month: 12, name: 'Dia do Mecânico', emoji: '🔧', dica: 'Gift card para presente de fim de ano', categoria: 'social' },
  { day: 21, month: 12, name: 'Início do Verão', emoji: '☀️', dica: '⭐ Lançar pacote verão — bronzeamento, hidratação, corpo', categoria: 'beleza' },
  { day: 25, month: 12, name: 'Natal', emoji: '🎄', dica: '⭐ DATA TOP — Gift cards, kits presente, promoção de Natal', categoria: 'marketing' },
  { day: 31, month: 12, name: 'Réveillon', emoji: '🥂', dica: 'Pacote "Réveillon ready" — tratamento express de fim de ano', categoria: 'marketing' },
]

/**
 * Retorna datas comemorativas próximas (dentro dos próximos N dias)
 */
export function getUpcomingDatas(diasAntecedencia: number = 30): (DataComemorativa & { daysUntil: number; dateThisYear: Date })[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const results: (DataComemorativa & { daysUntil: number; dateThisYear: Date })[] = []

  for (const d of datasGerais) {
    // Data este ano
    let dateThisYear = new Date(today.getFullYear(), d.month - 1, d.day)

    // Se já passou, verificar se está no range "até ontem"
    const diff = Math.floor((dateThisYear.getTime() - today.getTime()) / 86400000)

    if (diff < -1) {
      // Tentar ano que vem
      dateThisYear = new Date(today.getFullYear() + 1, d.month - 1, d.day)
      const diffNext = Math.floor((dateThisYear.getTime() - today.getTime()) / 86400000)
      if (diffNext <= diasAntecedencia) {
        results.push({ ...d, daysUntil: diffNext, dateThisYear })
      }
    } else if (diff <= diasAntecedencia) {
      results.push({ ...d, daysUntil: diff, dateThisYear })
    }
  }

  results.sort((a, b) => a.daysUntil - b.daysUntil)
  return results
}
