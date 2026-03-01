'use client'

import dynamic from 'next/dynamic'
import { Suspense } from 'react'

const FloatingWhatsApp = dynamic(() => import("@/components/FloatingWhatsApp"), { ssr: false })
const PWAProvider = dynamic(() => import("@/components/PWAProvider"), { ssr: false })

export default function ClientProviders() {
  return (
    <Suspense fallback={null}>
      <FloatingWhatsApp />
      <PWAProvider />
    </Suspense>
  )
}
