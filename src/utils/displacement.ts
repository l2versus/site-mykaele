// src/utils/displacement.ts
// Cálculo de taxa de deslocamento baseado em distância

/**
 * Endereço-base da Mykaele
 * Rua Francisco Martiniano Barbosa, 888, Sapiranga, Fortaleza-CE, CEP 60833-375
 */
export const BASE_ADDRESS = {
  street: 'Rua Francisco Martiniano Barbosa, 888',
  neighborhood: 'Sapiranga',
  city: 'Fortaleza',
  state: 'CE',
  zip: '60833-375',
  // Coordenadas aproximadas (Sapiranga, Fortaleza)
  lat: -3.7937,
  lng: -38.4784,
}

/**
 * Faixas de taxa de deslocamento (em km)
 * Até 5km = grátis (raio normal de atendimento)
 * 5-10km = R$ 30
 * 10-20km = R$ 50
 * 20-35km = R$ 80
 * 35-50km = R$ 120
 * >50km = atendimento sob consulta
 */
export const DISPLACEMENT_TIERS = [
  { maxKm: 5,  fee: 0,   label: 'Sem taxa (até 5 km)' },
  { maxKm: 10, fee: 30,  label: 'R$ 30,00 (5–10 km)' },
  { maxKm: 20, fee: 50,  label: 'R$ 50,00 (10–20 km)' },
  { maxKm: 35, fee: 80,  label: 'R$ 80,00 (20–35 km)' },
  { maxKm: 50, fee: 120, label: 'R$ 120,00 (35–50 km)' },
]

export const MAX_DISTANCE_KM = 50

/**
 * Calcula a taxa de deslocamento com base na distância em km
 */
export function getDisplacementFee(distanceKm: number): {
  fee: number
  label: string
  distanceKm: number
  isOutOfRange: boolean
} {
  if (distanceKm > MAX_DISTANCE_KM) {
    return {
      fee: 0,
      label: 'Distância acima de 50 km — consulte disponibilidade',
      distanceKm: Math.round(distanceKm * 10) / 10,
      isOutOfRange: true,
    }
  }

  for (const tier of DISPLACEMENT_TIERS) {
    if (distanceKm <= tier.maxKm) {
      return {
        fee: tier.fee,
        label: tier.label,
        distanceKm: Math.round(distanceKm * 10) / 10,
        isOutOfRange: false,
      }
    }
  }

  // Fallback (não deve chegar aqui)
  return {
    fee: 120,
    label: 'Taxa máxima',
    distanceKm: Math.round(distanceKm * 10) / 10,
    isOutOfRange: false,
  }
}

/**
 * Calcula distância em linha reta entre duas coordenadas (Haversine)
 * Usado como fallback quando a API de rotas não está disponível
 */
export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371 // raio da Terra em km
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

/**
 * Formata duração de viagem em minutos para texto legível
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

/**
 * Formata distância em km
 */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toFixed(1)} km`
}
