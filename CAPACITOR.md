# Native app (Capacitor)

PotKing ships as a web PWA **and** can be wrapped as a native iOS/Android app via
Capacitor. The native shell exists for the things iOS Safari/PWA can't do:

- **Real haptics** (Taptic Engine via `@capacitor/haptics`) — the web haptic
  fallback is unreliable on iOS.
- **Audio through the silent switch** (native audio session) — impossible on web.
- App Store presence, push notifications, stronger offline.

The web build is **unchanged** — GitHub Pages keeps deploying the PWA exactly as
before. Capacitor is purely additive.

## How it's wired

- `capacitor.config.ts` — appId/appName, `webDir: 'dist'`.
- `vite.config.ts` — when `CAP=1`, the build uses base `/` (webview root) and
  **disables the PWA service worker** (a SW is meaningless inside a webview). The
  PWA virtual module is aliased to `src/pwa-register-stub.ts` in that mode.
- `src/lib/haptics.ts` — uses the native Taptic Engine when
  `Capacitor.isNativePlatform()`, otherwise the existing web fallbacks.

## Scripts

```bash
npm run build:native   # CAP=1 build into dist/ (base /, no service worker)
npm run cap:sync       # build:native + copy web assets into the native project
npm run cap:ios        # cap:sync + open the iOS project in Xcode
```

## One-time setup (needs a Mac with full Xcode)

This machine currently has only the Command Line Tools. To generate and run the
iOS project you need:

1. **Full Xcode** from the App Store, then point the toolchain at it:
   ```bash
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   ```
2. **CocoaPods**:
   ```bash
   brew install cocoapods
   ```
3. **Add the iOS platform** (creates `ios/`, runs `pod install`):
   ```bash
   npm run build:native
   npx cap add ios
   ```
4. **Open & run**:
   ```bash
   npm run cap:ios   # opens Xcode; pick a simulator or your device, press ▶
   ```

For Android later: `npm i -D @capacitor/android && npx cap add android`.

## Before shipping to the App Store

- Change `appId` in `capacitor.config.ts` to a reverse-DNS id you own.
- $99/yr Apple Developer Program; set up signing in Xcode.
- **Supabase auth redirects**: email magic-link / OAuth need a custom URL scheme
  + deep-link handling. Email+password sign-in already works as-is.
- App icons / splash: `@capacitor/assets` can generate them from a source image.
- Consider live updates (`@capgo/capacitor-updater`) so JS/CSS changes don't need
  a full App Store review each time.
