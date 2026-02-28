// src/components/patient/PatientLayout.tsx
'use client'

import { ReactNode } from 'react'
import Link from 'next/link'

interface PatientLayoutProps {
  children: ReactNode
}

export function PatientLayout({ children }: PatientLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/patient" className="text-xl font-bold text-slate-900">
              Mykaele Paciente
            </Link>
            <div className="flex items-center gap-4">
              <span className="text-slate-700">Maria Silva</span>
              <button className="px-4 py-2 text-slate-700 hover:text-slate-900">
                Sair
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Sidebar Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Sidebar */}
          <aside className="lg:col-span-1">
            <nav className="space-y-2">
              <Link
                href="/patient"
                className="block px-4 py-3 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
              >
                📊 Dashboard
              </Link>
              <Link
                href="/patient/agendamentos"
                className="block px-4 py-3 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
              >
                📅 Meus Agendamentos
              </Link>
              <Link
                href="/patient/antes-depois"
                className="block px-4 py-3 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
              >
                🖼️ Antes & Depois
              </Link>
              <Link
                href="/patient/produtos-posvendas"
                className="block px-4 py-3 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
              >
                🛍️ Produtos Pós-Venda
              </Link>
              <Link
                href="/patient/documentos"
                className="block px-4 py-3 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
              >
                📄 Documentos
              </Link>
              <Link
                href="/patient/configuracoes"
                className="block px-4 py-3 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
              >
                ⚙️ Configurações
              </Link>
            </nav>
          </aside>

          {/* Main Content */}
          <main className="lg:col-span-3">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
