import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

/** Reactive Supabase session + auth actions. Safe no-ops when not configured. */
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const redirectTo = window.location.origin + import.meta.env.BASE_URL

  return {
    session,
    user: session?.user ?? null,
    loading,
    // emailRedirectTo points the confirmation link back at the deployed app
    // (must also be allow-listed under Supabase → Auth → URL Configuration)
    signUp: (email: string, password: string) =>
      supabase!.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } }),
    signIn: (email: string, password: string) => supabase!.auth.signInWithPassword({ email, password }),
    signInWithGoogle: () => supabase!.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } }),
    signOut: () => supabase!.auth.signOut(),
    // Permanently delete the signed-in account. The delete_account() RPC removes
    // the user's auth row (cascading to all their cloud data); then sign out so
    // the local session is cleared. Returns any error for the UI to surface.
    deleteAccount: async (): Promise<{ error: Error | null }> => {
      const { error } = await supabase!.rpc('delete_account')
      if (error) return { error }
      await supabase!.auth.signOut()
      return { error: null }
    },
  }
}
