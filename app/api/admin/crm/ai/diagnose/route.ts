import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { diagnoseAiProviders } from '@/lib/gemini'

function isAdmin(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return false
  const user = verifyToken(auth.substring(7))
  return user?.role === 'ADMIN'
}

// GET — testa cada provedor de IA com a chave salva no banco e diz quais estão ok/vencidas.
export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  try {
    const providers = await diagnoseAiProviders()
    const usaveis = providers.filter(p => p.ok).map(p => p.provider)
    return NextResponse.json({ providers, usaveis, testedAt: new Date().toISOString() })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao diagnosticar provedores' },
      { status: 500 },
    )
  }
}
