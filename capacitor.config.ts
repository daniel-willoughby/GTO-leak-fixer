import type { CapacitorConfig } from '@capacitor/cli'

// Native (iOS/Android) shell config. The web build is unaffected — this only
// matters for `cap sync` / native builds, which consume the `dist/` produced by
// `npm run build:native` (base '/', no service worker).
const config: CapacitorConfig = {
  appId: 'com.potking.app', // reverse-DNS bundle id — change to one you own before shipping
  appName: 'PotKing',
  webDir: 'dist',
  ios: {
    // let the webview content extend under the status bar / home indicator;
    // the app already handles safe-area insets in CSS
    contentInset: 'never',
  },
}

export default config
