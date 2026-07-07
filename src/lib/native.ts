// Native-shell setup. No-ops on the web; on the Capacitor iOS/Android build it
// styles the status bar to match the app chrome and dismisses the launch splash
// once React has mounted. Kept in one place so the web bundle tree-shakes the
// plugin calls away when they never run.
import { Capacitor } from '@capacitor/core'

export async function initNative(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    // The app renders its own light "paper" chrome under the status bar, so use
    // dark text/icons. overlaysWebView keeps content edge-to-edge (matches the
    // `contentInset: 'never'` in capacitor.config.ts and the safe-area CSS).
    await StatusBar.setStyle({ style: Style.Light })
    await StatusBar.setOverlaysWebView({ overlay: true })
  } catch {
    /* status-bar plugin not available — non-fatal */
  }
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen')
    await SplashScreen.hide()
  } catch {
    /* splash plugin not available — non-fatal */
  }
}
