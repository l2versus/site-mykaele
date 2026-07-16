import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Antes e Depois: Resultados Reais a Domicílio em Fortaleza',
  description: 'Registros reais de antes e depois de atendimentos de fisioterapia dermatofuncional a domicílio em Fortaleza — Aldeota, Meireles, Cocó e região. Massagem, Método Fluir e protocolo para lipedema por Mykaele Procópio. Resultados variam de pessoa para pessoa.',
  openGraph: {
    title: 'Antes e Depois — Mykaele Procópio Home Spa Fortaleza',
    description: 'Registros reais de atendimentos a domicílio em Fortaleza, sem filtros. Resultados variam de pessoa para pessoa.',
  },
  alternates: {
    canonical: 'https://mykaprocopio.com.br/galeria-resultados',
  },
}

export default function GaleriaLayout({ children }: { children: React.ReactNode }) {
  return children
}
