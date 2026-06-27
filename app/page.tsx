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
  title: 'Mykaele Procópio | Estética Avançada & Arquitetura Corporal em Fortaleza',
  description: 'Fisioterapeuta Dermatofuncional especializada em Arquitetura Corporal. Atendimento premium a domicílio (Home Spa) em Fortaleza-CE. Massagem relaxante, método Fluir, despertar sensorial. Resultados reais, protocolos personalizados. Agende online.',
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
