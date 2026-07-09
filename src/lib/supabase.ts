// Optional Supabase client. The app works fully offline; cloud sync only turns
// on when these env vars are provided at build time (VITE_ prefix → inlined by
// Vite). The anon key is public by design, row-level security protects data.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// `import.meta.env` only exists under Vite; guard it so Node-based tooling
// (test harnesses, scripts) can import modules that transitively pull this in.
const env = (import.meta as { env?: Record<string, string> }).env ?? {}
const url = env.VITE_SUPABASE_URL as string | undefined
const anonKey = env.VITE_SUPABASE_ANON_KEY as string | undefined

/** True when cloud sync is configured, gates all account UI. */
export const supabaseConfigured = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null
