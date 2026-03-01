'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState, ReactNode } from 'react'

/**
 * PageTransition — Smooth page transitions with fade + slide
 * Wraps content with entrance animation on route change
 */

export default function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [show, setShow] = useState(false)
  const [displayChildren, setDisplayChildren] = useState(children)

  useEffect(() => {
    setShow(false)
    // Short delay then show new content with animation
    const t = setTimeout(() => {
      setDisplayChildren(children)
      setShow(true)
    }, 80)
    return () => clearTimeout(t)
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="transition-all duration-300 ease-out"
      style={{
        opacity: show ? 1 : 0,
        transform: show ? 'translateY(0)' : 'translateY(12px)',
      }}
    >
      {displayChildren}
    </div>
  )
}
