import { redirect } from 'next/navigation'

export default async function RefPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  // Redirecionar para registro com código de indicação pré-preenchido
  redirect(`/cliente?ref=${encodeURIComponent(code)}`)
}
