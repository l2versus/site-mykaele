import { Header } from '@/components/Header'
import { HeroSection } from '@/components/HeroSection'
import { Footer } from '@/components/Footer'
import HomeAnimations from '@/components/HomeAnimations'
import HomeIntro from '@/components/HomeIntro'
import Preloader from '@/components/Preloader'
import StackScroll from '@/components/StackScroll'
import dynamic from 'next/dynamic'
import type { Metadata } from 'next'

// Abaixo do fold — carregam sob demanda
const ResultadosReais = dynamic(() => import('@/components/ResultadosReais'))
const AgendamentoSection = dynamic(() => import('@/components/AgendamentoSection'))
const FAQ = dynamic(() => import('@/components/FAQ'))

export const metadata: Metadata = {
  // `absolute` evita o sufixo do template do layout (título limpo e keyword-rich)
  title: { absolute: 'Fisioterapeuta Dermatofuncional em Fortaleza | Home Spa de Luxo a Domicílio — Mykaele Procópio' },
  description: 'Estética avançada e arquitetura corporal a domicílio em Fortaleza — Aldeota, Meireles, Cocó e região. Massagem modeladora, drenagem linfática e protocolos personalizados no conforto da sua casa, com privacidade absoluta. Resultados desde a 1ª sessão. Agende online.',
  alternates: {
    canonical: 'https://mykaprocopio.com.br',
  },
}

export default function Home() {
  return (
    <div id="main-content" role="main" className="min-h-screen bg-nude overflow-x-clip">
      <Preloader />
      <StackScroll />
      <HomeAnimations />
      <Header />
      {/* Dobras com stacking (sticky) ficam num wrapper que limita a região sticky */}
      <div className="relative">
        <HeroSection />
        <HomeIntro />
      </div>
      <ResultadosReais />
      <AgendamentoSection />
      <FAQ />
      <Footer />
    </div>
  )
}
