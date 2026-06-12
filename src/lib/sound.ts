// Tiny Web Audio sound engine, synthesised tones, no asset files, works offline.

let muted = localStorage.getItem('lt-muted') === '1'
let ctx: AudioContext | null = null

function audio(): AudioContext {
  ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
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

export function playCorrect() {
  if (muted) return
  tone({ freq: 587, dur: 0.12, type: 'triangle' }) // D5
  tone({ freq: 880, dur: 0.18, type: 'triangle', delay: 0.1 }) // A5
}

export function playWrong() {
  if (muted) return
  tone({ freq: 196, dur: 0.26, type: 'sawtooth', gain: 0.1, slideTo: 120 })
}

export function playClick() {
  if (muted) return
  tone({ freq: 420, dur: 0.05, type: 'square', gain: 0.06 })
}

export function playDeal() {
  if (muted) return
  tone({ freq: 320, dur: 0.06, type: 'sine', gain: 0.08 })
}

export function playStreak() {
  if (muted) return
  ;[523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.12, type: 'triangle', delay: i * 0.07 }))
}

export function isMuted() {
  return muted
}
export function setMuted(v: boolean) {
  muted = v
  localStorage.setItem('lt-muted', v ? '1' : '0')
}
