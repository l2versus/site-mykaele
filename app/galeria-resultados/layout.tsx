import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Galeria de Resultados | Antes e Depois',
  description: 'Veja transformações reais de pacientes satisfeitos. Resultados comprovados de procedimentos de estética avançada, arquitetura corporal e tratamentos faciais por Mykaele Procópio em Fortaleza.',
  openGraph: {
    title: 'Galeria de Resultados — Mykaele Procópio Home Spa',
    description: 'Transformações reais com fotos de antes e depois. Resultados comprovados de estética avançada em Fortaleza.',
  },
  alternates: {
    canonical: 'https://mykaprocopio.com.br/galeria-resultados',
  },
}

export default function GaleriaLayout({ children }: { children: React.ReactNode }) {
  return children
}
