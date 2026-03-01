'use client'

import { ReactNode } from 'react'

/**
 * Premium skeleton components with shimmer animation
 * Provides Apple-quality loading states
 */

// Base shimmer classes
const shimmer = 'relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/40 before:to-transparent'

export function SkeletonBox({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-lg bg-gray-200/60 ${shimmer} ${className}`}
      aria-hidden="true"
    />
  )
}

export function SkeletonCircle({ size = 'w-10 h-10' }: { size?: string }) {
  return (
    <div
      className={`rounded-full bg-gray-200/60 ${shimmer} ${size}`}
      aria-hidden="true"
    />
  )
}

export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`h-3 rounded bg-gray-200/60 ${shimmer}`}
          style={{ width: i === lines - 1 ? '70%' : '100%' }}
        />
      ))}
    </div>
  )
}

// Card skeleton — for service cards, appointment cards, etc.
export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-2xl border border-gray-100 p-4 space-y-3 ${className}`} aria-hidden="true">
      <SkeletonBox className="h-40 w-full rounded-xl" />
      <SkeletonBox className="h-5 w-3/4" />
      <SkeletonText lines={2} />
      <div className="flex gap-2 pt-1">
        <SkeletonBox className="h-8 w-20 rounded-full" />
        <SkeletonBox className="h-8 w-24 rounded-full" />
      </div>
    </div>
  )
}

// Appointment skeleton
export function SkeletonAppointment() {
  return (
    <div className="rounded-2xl border border-gray-100 p-4 flex items-center gap-4" aria-hidden="true">
      <SkeletonCircle size="w-12 h-12" />
      <div className="flex-1 space-y-2">
        <SkeletonBox className="h-4 w-1/2" />
        <SkeletonBox className="h-3 w-1/3" />
      </div>
      <SkeletonBox className="h-8 w-16 rounded-full" />
    </div>
  )
}

// Profile skeleton
export function SkeletonProfile() {
  return (
    <div className="flex flex-col items-center gap-4 py-8" aria-hidden="true">
      <SkeletonCircle size="w-24 h-24" />
      <SkeletonBox className="h-5 w-40" />
      <SkeletonBox className="h-3 w-32" />
      <div className="w-full max-w-sm space-y-3 mt-4">
        <SkeletonBox className="h-12 w-full rounded-xl" />
        <SkeletonBox className="h-12 w-full rounded-xl" />
        <SkeletonBox className="h-12 w-full rounded-xl" />
      </div>
    </div>
  )
}

// KPI card skeleton (admin)
export function SkeletonKPI() {
  return (
    <div className="rounded-2xl border border-gray-100 p-4 space-y-2" aria-hidden="true">
      <div className="flex items-center justify-between">
        <SkeletonCircle size="w-8 h-8" />
        <SkeletonBox className="h-4 w-12 rounded" />
      </div>
      <SkeletonBox className="h-8 w-24" />
      <SkeletonBox className="h-3 w-16" />
    </div>
  )
}

// Loading container with fade-in animation
export function SkeletonContainer({ children, isLoading, fallback }: {
  children: ReactNode
  isLoading: boolean
  fallback: ReactNode
}) {
  if (isLoading) return <>{fallback}</>
  return <div className="animate-fadeIn">{children}</div>
}
