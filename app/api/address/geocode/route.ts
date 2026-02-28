// app/api/address/geocode/route.ts
// Geocodifica endereço usando Nominatim (OpenStreetMap — gratuito, sem chave)
// e calcula distância/preço de deslocamento
import { NextRequest, NextResponse } from 'next/server'
import { BASE_ADDRESS, haversineDistance, getDisplacementFee, formatDistance } from '@/utils/displacement'

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address')
  if (!address) {
    return NextResponse.json({ error: 'Endereço obrigatório' }, { status: 400 })
  }

  try {
    // Geocodificar via Nominatim (OpenStreetMap — free, sem API key)
    const query = encodeURIComponent(`${address}, Fortaleza, CE, Brasil`)
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=br`,
      {
        headers: { 'User-Agent': 'MykaeleHomeSpa/1.0' },
        next: { revalidate: 3600 },
      }
    )
    const results = await res.json()

    if (!results || results.length === 0) {
      return NextResponse.json({ error: 'Endereço não encontrado no mapa' }, { status: 404 })
    }

    const { lat, lon, display_name } = results[0]
    const clientLat = parseFloat(lat)
    const clientLng = parseFloat(lon)

    // Calcular distância em linha reta (Haversine)
    const distanceKm = haversineDistance(
      BASE_ADDRESS.lat, BASE_ADDRESS.lng,
      clientLat, clientLng
    )

    // Fator de correção para rota real (ruas ~1.3x linha reta)
    const routeDistanceKm = distanceKm * 1.3

    // Calcular taxa de deslocamento
    const displacement = getDisplacementFee(routeDistanceKm)

    // Links para navegação
    const wazeUrl = `https://waze.com/ul?ll=${clientLat},${clientLng}&navigate=yes`
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${clientLat},${clientLng}`
    const uberUrl = `https://m.uber.com/ul/?action=setPickup&dropoff[latitude]=${clientLat}&dropoff[longitude]=${clientLng}&dropoff[nickname]=${encodeURIComponent('Cliente')}`
    const app99Url = `https://99app.com/ride?dropoffLat=${clientLat}&dropoffLng=${clientLng}`

    return NextResponse.json({
      coordinates: { lat: clientLat, lng: clientLng },
      displayName: display_name,
      distance: {
        straightLine: formatDistance(distanceKm),
        estimated: formatDistance(routeDistanceKm),
        km: Math.round(routeDistanceKm * 10) / 10,
      },
      displacement: {
        fee: displacement.fee,
        label: displacement.label,
        isOutOfRange: displacement.isOutOfRange,
      },
      navigationLinks: {
        waze: wazeUrl,
        googleMaps: googleMapsUrl,
        uber: uberUrl,
        app99: app99Url,
      },
    })
  } catch (error) {
    console.error('Geocode error:', error)
    return NextResponse.json({ error: 'Erro ao geocodificar endereço' }, { status: 500 })
  }
}
