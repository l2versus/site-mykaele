// src/lib/crm-feedback.ts — Micro-feedback com sons e Vibration API

type FeedbackType = 'drop' | 'won' | 'lost' | 'message' | 'error' | 'click'

const VOLUME = 0.12

/** Frequências de tom para cada tipo de feedback */
const TONE_MAP: Record<FeedbackType, { freq: number; duration: number; type: OscillatorType }> = {
  drop:    { freq: 600, duration: 80, type: 'sine' },
  won:     { freq: 880, duration: 200, type: 'sine' },
  lost:    { freq: 220, duration: 150, type: 'triangle' },
  message: { freq: 1200, duration: 60, type: 'sine' },
  error:   { freq: 300, duration: 200, type: 'sawtooth' },
  click:   { freq: 800, duration: 30, type: 'sine' },
}

/** Padrões de vibração em ms para cada tipo */
const VIBRATION_MAP: Record<FeedbackType, number[]> = {
  drop:    [15],
  won:     [30, 50, 30],
  lost:    [50, 30, 80],
  message: [10],
  error:   [80, 40, 80],
  click:   [8],
}

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    try {
      audioCtx = new AudioContext()
    } catch {
      return null
    }
  }
  return audioCtx
}

function playTone(freq: number, duration: number, type: OscillatorType): void {
  const ctx = getAudioContext()
  if (!ctx) return

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = type
  osc.frequency.value = freq
  gain.gain.value = VOLUME

  // Fade out suave para evitar clique
  gain.gain.setValueAtTime(VOLUME, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000)

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.start()
  osc.stop(ctx.currentTime + duration / 1000)
}

function vibrate(pattern: number[]): void {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(pattern)
  }
}

/**
 * Reproduz feedback sonoro + vibração tátil.
 * Volume fixo em 12%. Seguro para SSR (no-op no servidor).
 */
export function playFeedback(type: FeedbackType): void {
  if (typeof window === 'undefined') return

  const tone = TONE_MAP[type]
  if (tone) {
    playTone(tone.freq, tone.duration, tone.type)
  }

  const pattern = VIBRATION_MAP[type]
  if (pattern) {
    vibrate(pattern)
  }
}
