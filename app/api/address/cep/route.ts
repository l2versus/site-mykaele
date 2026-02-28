// app/api/address/cep/route.ts
// Busca endereço por CEP usando ViaCEP (gratuito, sem chave)
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const cep = request.nextUrl.searchParams.get('cep')?.replace(/\D/g, '')

  if (!cep || cep.length !== 8) {
    return NextResponse.json({ error: 'CEP inválido (8 dígitos)' }, { status: 400 })
  }

  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      next: { revalidate: 86400 }, // cache 24h
    })
    const data = await res.json()

    if (data.erro) {
      return NextResponse.json({ error: 'CEP não encontrado' }, { status: 404 })
    }

    return NextResponse.json({
      cep: data.cep,
      street: data.logradouro || '',
      complement: data.complemento || '',
      neighborhood: data.bairro || '',
      city: data.localidade || '',
      state: data.uf || '',
      ibge: data.ibge || '',
    })
  } catch (error) {
    console.error('ViaCEP error:', error)
    return NextResponse.json({ error: 'Erro ao consultar CEP' }, { status: 500 })
  }
}
