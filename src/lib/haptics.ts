// Lightweight haptics. Fires independently of the sound mute so a player gets
// tactile feedback even with the device on silent.
//
// Coverage by platform:
//   • Native (Capacitor iOS/Android): real Taptic Engine via @capacitor/haptics.
//   • Android / Chrome web: the Vibration API works, including in silent mode.
//   • iOS Safari + standalone PWA: navigator.vibrate is NOT supported. We fall
//     back to the iOS 17.4+ "switch" haptic trick, toggling a hidden
//     <input type="checkbox" switch> inside a label triggers the system tap.
//     This only fires inside a user gesture and is best-effort, but it's the
//     only web haptic iOS exposes. (Native wrapper avoids all this.)
import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'

let enabled = localStorage.getItem('lt-haptics') !== '0'

const isNative = Capacitor.isNativePlatform()
const canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'

/** Real device haptics when running inside the native shell. */
function nativeHaptic(kind: HapticKind): Promise<void> {
  switch (kind) {
    case 'success':
    case 'celebrate':
      return Haptics.notification({ type: NotificationType.Success })
    case 'error':
      return Haptics.notification({ type: NotificationType.Error })
    case 'light':
    default:
      return Haptics.impact({ style: ImpactStyle.Light })
  }
}

// Lazily-created hidden <label><input type="checkbox" switch></label>. Clicking
// the *label* toggles the switch, which is what fires the iOS system haptic;
// this is the canonical form used by web haptic libraries.
let iosLabel: HTMLLabelElement | null = null
function iosHapticEl(): HTMLLabelElement | null {
  if (typeof document === 'undefined') return null
  if (iosLabel) return iosLabel
  const label = document.createElement('label')
  label.setAttribute('aria-hidden', 'true')
  label.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;pointer-events:none;opacity:0'
  const input = document.createElement('input')
  input.type = 'checkbox'
  input.setAttribute('switch', '') // Safari-only attribute that carries the haptic
  label.appendChild(input)
  document.body.appendChild(label)
  iosLabel = label
  return label
}

export type HapticKind = 'light' | 'success' | 'error' | 'celebrate'

const PATTERN: Record<HapticKind, number | number[]> = {
  light: 8,
  success: 14,
  error: [18, 45, 18],
  celebrate: [10, 30, 10, 30, 20],
}

/** Fire a haptic of the given kind. No-op when disabled or unsupported. */
export function haptic(kind: HapticKind = 'light'): void {
  if (!enabled) return
  if (isNative) {
    void nativeHaptic(kind).catch(() => {})
    return
  }
  if (canVibrate) {
    try {
      if (navigator.vibrate(PATTERN[kind])) return
    } catch { /* fall through to the iOS path */ }
  }
  // iOS best-effort: must run synchronously within a user gesture.
  try {
    iosHapticEl()?.click()
  } catch { /* no-op */ }
}

export function hapticsEnabled(): boolean {
  return enabled
}
export function setHaptics(v: boolean): void {
  enabled = v
  localStorage.setItem('lt-haptics', v ? '1' : '0')
}
