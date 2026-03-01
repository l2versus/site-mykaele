import { Header } from '@/components/Header'
import { HeroSection } from '@/components/HeroSection'
import { ServicesSection } from '@/components/ServicesSection'
import { Footer } from '@/components/Footer'
import { SectionNav } from '@/components/SectionNav'
import HomeAnimations from '@/components/HomeAnimations'
import dynamic from 'next/dynamic'
import type { Metadata } from 'next'

// Dynamic imports para componentes abaixo do fold — reduz bundle JS inicial em ~40%
const ResultadosReais = dynamic(() => import('@/components/ResultadosReais'))
const Testimoniais = dynamic(() => import('@/components/Testimoniais'))
const EquipeAmbiente = dynamic(() => import('@/components/EquipeAmbiente'))
const GaleriaVideos = dynamic(() => import('@/components/GaleriaVideos'))
const AboutMykaele = dynamic(() => import('@/components/AboutMykaele'))
const AgendamentoSection = dynamic(() => import('@/components/AgendamentoSection'))
const TechnologiesSection = dynamic(() => import('@/components/TechnologiesSection').then(m => ({ default: m.TechnologiesSection })))

export const metadata: Metadata = {
  title: 'Mykaele Procópio | Estética Avançada & Arquitetura Corporal em Fortaleza',
  description: 'Fisioterapeuta Dermatofuncional especializada em Arquitetura Corporal. Drenagem linfática, limpeza de pele, peeling, microagulhamento, massagem modeladora. Resultados reais, protocolos personalizados. Atendimento premium em Fortaleza-CE e domicílio (Home Spa). Agende online.',
  alternates: {
    canonical: 'https://mykaprocopio.com.br',
  },
}

export default function Home() {
  return (
    <div className="min-h-screen bg-[#faf9f7] overflow-x-hidden">
      <HomeAnimations />
      <Header />
      <SectionNav />
      <HeroSection />

      {/* Respiro editorial entre hero e metodo */}
      <section className="bg-[#faf9f7] py-16 md:py-32">
        <div className="max-w-[1400px] mx-auto px-6 md:px-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-20 items-center">
            <div className="lg:col-span-5 reveal-blur">
              <span className="text-[10px] font-medium tracking-[0.35em] uppercase text-[#b76e79]/60 block mb-6">
                Mykaele Procópio Home Spa
              </span>
              <h2 className="text-[clamp(1.6rem,3vw,2.4rem)] font-extralight leading-[1.15] tracking-[-0.02em] text-[#2d2d2d]">
                Onde a ciência encontra
                <br />
                <span className="font-light text-[#b76e79]">a arte da transformação</span>
              </h2>
            </div>
            <div className="lg:col-span-6 lg:col-start-7 reveal-blur delay-300">
              <p className="text-[15px] text-[#6a6560] font-light leading-[1.9]">
                Cada sessão é um protocolo de precisão — combinando técnicas avançadas
                de fisioterapia estética com o conforto de um atendimento exclusivo.
                Resultados mensuráveis desde o primeiro encontro.
              </p>
              <div className="flex items-center gap-3 mt-6">
                <span className="w-8 h-[1px] bg-[#b76e79]/40" />
                <span className="text-[10px] font-medium tracking-[0.2em] uppercase text-[#b76e79]/50">Atendimento sob consulta · Vagas limitadas</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <ServicesSection />
      <ResultadosReais />
      <AboutMykaele />
      <Testimoniais />
      <EquipeAmbiente />
      <GaleriaVideos />
      <TechnologiesSection />
      <AgendamentoSection />
      <Footer />
    </div>
  )
}
