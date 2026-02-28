import { Header } from '@/components/Header'
import { HeroSection } from '@/components/HeroSection'
import { ServicesSection } from '@/components/ServicesSection'
import { TechnologiesSection } from '@/components/TechnologiesSection'
import { Footer } from '@/components/Footer'
import ResultadosReais from '@/components/ResultadosReais'
import Testimoniais from '@/components/Testimoniais'
import EquipeAmbiente from '@/components/EquipeAmbiente'
import GaleriaVideos from '@/components/GaleriaVideos'
import AboutMykaele from '@/components/AboutMykaele'
import AgendamentoSection from '@/components/AgendamentoSection'
import { SectionNav } from '@/components/SectionNav'
import HomeAnimations from '@/components/HomeAnimations'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Mykaele Procópio | Estética Avançada & Arquitetura Corporal em Fortaleza',
  description: 'Fisioterapeuta Dermatofuncional especializada em Arquitetura Corporal. Drenagem linfática, limpeza de pele, peeling, microagulhamento, massagem modeladora. Resultados reais, protocolos personalizados. Atendimento premium em Fortaleza-CE e domicílio (Home Spa). Agende online.',
  alternates: {
    canonical: 'https://mykaprocopio.com.br',
  },
}

export default function Home() {
  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <HomeAnimations />
      <Header />
      <SectionNav />
      <HeroSection />

      {/* Respiro editorial entre hero e método */}
      <section className="bg-[#faf9f7] py-24 md:py-32">
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
