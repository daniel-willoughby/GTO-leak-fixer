// Tiny Web Audio sound engine, synthesised tones, no asset files, works offline.
import { haptic } from './haptics'

let muted = localStorage.getItem('lt-muted') === '1'
let ctx: AudioContext | null = null

function audio(): AudioContext {
  ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

// iOS suspends AudioContext whenever the page loses focus and won't let it
// resume outside a user gesture. Keep a persistent listener on every gesture
// so the context is always resumed before the next sound plays.
if (typeof window !== 'undefined') {
  const resume = () => {
    try {
      if (ctx && ctx.state === 'suspended') void ctx.resume()
    } catch { /* no-op */ }
  }
  window.addEventListener('pointerdown', resume, { passive: true })
  window.addEventListener('touchstart', resume, { passive: true })
  window.addEventListener('keydown', resume, { passive: true })
}

interface ToneOpts {
  freq: number
  dur: number
  type?: OscillatorType
  gain?: number
  delay?: number
  slideTo?: number
}

function tone({ freq, dur, type = 'sine', gain = 0.14, delay = 0, slideTo }: ToneOpts) {
  const ac = audio()
  const t0 = ac.currentTime + delay
  const osc = ac.createOscillator()
  const g = ac.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur)
  // quick attack, smooth decay
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g).connect(ac.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

// Haptics fire before the mute check so a silenced device still gives feedback.
export function playCorrect() {
  haptic('success')
  if (muted) return
  tone({ freq: 587, dur: 0.12, type: 'triangle' }) // D5
  tone({ freq: 880, dur: 0.18, type: 'triangle', delay: 0.1 }) // A5
}

export function playWrong() {
  haptic('error')
  if (muted) return
  tone({ freq: 196, dur: 0.26, type: 'sawtooth', gain: 0.1, slideTo: 120 })
}

export function playClick() {
  haptic('light')
  if (muted) return
  tone({ freq: 420, dur: 0.05, type: 'square', gain: 0.06 })
}

export function playDeal() {
  if (muted) return
  tone({ freq: 320, dur: 0.06, type: 'sine', gain: 0.08 })
}

export function playStreak() {
  haptic('celebrate')
  if (muted) return
  ;[523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.12, type: 'triangle', delay: i * 0.07 }))
}

/**
 * Loot-box reel: a run of decelerating ticks (dense at first, spacing out as it
 * slows) ending on a low "thunk" as it lands, then a short win chime — grander
 * for an ultra-rare/legendary pull. Scheduled on the audio clock so it stays in
 * step with the 5s visual reel.
 */
export function playLootReel(durationMs: number, special = false) {
  if (muted) return
  const T = durationMs / 1000
  const K = 40 // tick count ≈ items that pass the pointer
  for (let k = 1; k <= K; k++) {
    // ease-out timing: small gaps early (fast), large gaps late (slowing down)
    const delay = T * (1 - Math.pow(1 - k / K, 1 / 3))
    tone({ freq: 1040, dur: 0.028, type: 'square', gain: 0.05, delay })
  }
  // landing thunk
  tone({ freq: 190, dur: 0.2, type: 'sine', gain: 0.2, delay: T, slideTo: 90 })
  // win chime on the reveal (a beat after the land), bigger for specials
  const chime = special ? [659, 880, 1175, 1568] : [523, 784, 1047]
  chime.forEach((f, i) =>
    tone({ freq: f, dur: 0.18, type: 'triangle', gain: 0.13, delay: T + 0.3 + i * 0.08 }),
  )
}

export function isMuted() {
  return muted
}
export function setMuted(v: boolean) {
  muted = v
  localStorage.setItem('lt-muted', v ? '1' : '0')
}
