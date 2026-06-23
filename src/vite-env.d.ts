/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
/// <reference types="vite-plugin-pwa/react" />

// Fontsource packages ship CSS only (no types); declare the whole scope so any
// side-effect font import type-checks (avoids TS2882 in the production build).
declare module '@fontsource-variable/*'

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
