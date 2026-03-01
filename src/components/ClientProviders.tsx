'use client'

import dynamic from 'next/dynamic'

const FloatingWhatsApp = dynamic(() => import("@/components/FloatingWhatsApp"), { ssr: false })
const PWAProvider = dynamic(() => import("@/components/PWAProvider"), { ssr: false })

export default function ClientProviders() {
  return (
    <>
      <FloatingWhatsApp />
      <PWAProvider />
    </>
  )
}
