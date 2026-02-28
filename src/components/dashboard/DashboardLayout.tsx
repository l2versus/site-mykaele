// src/components/dashboard/DashboardLayout.tsx
'use client'

import { ReactNode } from 'react'
import Link from 'next/link'

interface DashboardLayoutProps {
  children: ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const menuItems = [
    { label: 'Dashboard', href: '/dashboard', icon: '📊' },
    { label: 'Agenda', href: '/dashboard/agenda', icon: '📅' },
    { label: 'Pacientes', href: '/dashboard/pacientes', icon: '👥' },
    { label: 'Profissionais', href: '/dashboard/profissionais', icon: '👨‍⚕️' },
    { label: 'Financeiro', href: '/dashboard/financeiro', icon: '💰' },
    { label: 'Salas & Equipamentos', href: '/dashboard/recursos', icon: '🏥' },
    { label: 'Relatórios', href: '/dashboard/relatorios', icon: '📈' },
    { label: 'Configurações', href: '/dashboard/configuracoes', icon: '⚙️' },
  ]

  return (
    <div className="flex h-screen bg-slate-100">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white p-4 overflow-y-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Mykaele Admin</h1>
          <p className="text-slate-400 text-sm">Painel de Controle</p>
        </div>

        <nav className="space-y-2">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <span className="text-lg">{item.icon}</span>
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Usuário */}
        <div className="mt-12 pt-4 border-t border-slate-700">
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-800/50">
            <div className="w-8 h-8 bg-slate-600 rounded-full"></div>
            <div className="text-sm">
              <p className="font-medium">Dra. Maria Silva</p>
              <p className="text-slate-400 text-xs">Administrador</p>
            </div>
          </div>
          <button className="w-full mt-3 px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors">
            Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-slate-900">Painel de Controle</h2>
          <div className="flex items-center gap-4">
            <input
              type="text"
              placeholder="Buscar..."
              className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
            />
            <button className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900">
              Nova Consulta
            </button>
          </div>
        </div>

        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
