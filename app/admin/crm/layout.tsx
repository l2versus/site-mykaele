'use client'

import { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const CRM_NAV = [
  { href: '/admin/crm/pipeline', label: 'Pipeline' },
  { href: '/admin/crm/inbox', label: 'Inbox' },
  { href: '/admin/crm/contacts', label: 'Contatos' },
  { href: '/admin/crm/intelligence', label: 'Inteligência' },
  { href: '/admin/crm/automations', label: 'Automações' },
  { href: '/admin/crm/integrations', label: 'Integrações' },
  { href: '/admin/crm/system/dlq', label: 'Sistema' },
]

export default function CrmLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="-m-4 lg:-m-6 min-h-[calc(100vh-3.5rem)] lg:min-h-[calc(100vh-4rem)]" style={{ background: '#0A0A0B' }}>
      {/* Sub-navegação horizontal */}
      <nav className="sticky top-14 lg:top-16 z-20 border-b px-4 lg:px-6 flex items-center gap-1 overflow-x-auto scrollbar-none"
        style={{
          borderColor: 'var(--crm-border, #2A2A32)',
          background: 'rgba(10,10,11,0.95)',
          backdropFilter: 'blur(20px)',
        }}
      >
        {CRM_NAV.map((item) => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors"
              style={{
                color: active ? '#D4AF37' : '#8B8A94',
              }}
            >
              {item.label}
              {active && (
                <span
                  className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full"
                  style={{ background: '#D4AF37' }}
                />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Conteúdo da página CRM */}
      <div className="p-4 lg:p-6">
        {children}
      </div>

      {/* CSS Variables para CRM — :root para disponibilidade global */}
      <style jsx global>{`
        :root {
          --crm-bg: #0A0A0B;
          --crm-surface: #111114;
          --crm-surface-2: #1A1A1F;
          --crm-border: #2A2A32;
          --crm-gold: #D4AF37;
          --crm-gold-subtle: rgba(212,175,55,0.12);
          --crm-text: #F0EDE8;
          --crm-text-muted: #8B8A94;
          --crm-hot: #FF6B4A;
          --crm-warm: #F0A500;
          --crm-cold: #4A7BFF;
          --crm-won: #2ECC8A;
        }
      `}</style>
    </div>
  )
}
