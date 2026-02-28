// src/components/HomeAnimations.tsx
'use client'
import { useScrollReveal, useParallax, useCounterAnimation } from '@/hooks/useScrollAnimation'

/**
 * Client-side wrapper that initializes scroll animations.
 * Keeps the main page as a Server Component for SEO (SSR).
 */
export default function HomeAnimations() {
  useScrollReveal()
  useParallax()
  useCounterAnimation()
  return null
}
