'use client'

import { useState } from 'react'
import Image from 'next/image'

function getInitials(name?: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2)
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return parts[0][0]?.toUpperCase() || '?'
}

interface UserAvatarProps {
  src?: string | null
  name?: string | null
  /** Tailwind classes for size, rounding, shadow, ring, border, etc. */
  className?: string
  /** Tailwind text-size class for the initials (e.g. "text-3xl sm:text-4xl") */
  initialsClassName?: string
}

export function UserAvatar({
  src,
  name,
  className = 'w-10 h-10 rounded-full shadow-lg shadow-[#b76e79]/20 ring-2 ring-[#b76e79]/10',
  initialsClassName = 'text-sm',
}: UserAvatarProps) {
  const [imgError, setImgError] = useState(false)
  const initials = getInitials(name)

  if (!src || imgError) {
    return (
      <div
        className={`bg-gradient-to-br from-[#c28a93] to-[#9e6670] flex items-center justify-center text-white font-light ${className}`}
      >
        <span className={initialsClassName}>{initials}</span>
      </div>
    )
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <Image
        src={src}
        alt={name || ''}
        fill
        className="object-cover"
        onError={() => setImgError(true)}
        unoptimized={src.startsWith('data:')}
      />
    </div>
  )
}
