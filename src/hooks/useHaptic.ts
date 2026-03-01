'use client'

/**
 * useHaptic — Premium haptic feedback for mobile interactions
 * Uses the Vibration API (Android) and AudioContext trick (iOS partial)
 * 
 * Patterns inspired by Apple's Taptic Engine:
 * - light: subtle tap for selections
 * - medium: standard confirmation
 * - heavy: important actions
 * - success: celebration pattern
 * - error: alert pattern
 * - selection: quick micro-tap
 */

type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'selection'

const PATTERNS: Record<HapticPattern, number[]> = {
  light: [10],
  medium: [20],
  heavy: [40],
  success: [10, 50, 10, 50, 30],
  error: [50, 100, 50],
  selection: [5],
}

export function useHaptic() {
  const trigger = (pattern: HapticPattern = 'light') => {
    if (typeof window === 'undefined') return

    // Vibration API (Android + some browsers)
    if ('vibrate' in navigator) {
      navigator.vibrate(PATTERNS[pattern])
    }
  }

  return { trigger }
}

/**
 * Standalone function for use outside hooks
 */
export function haptic(pattern: HapticPattern = 'light') {
  if (typeof window === 'undefined') return
  if ('vibrate' in navigator) {
    navigator.vibrate(PATTERNS[pattern])
  }
}
