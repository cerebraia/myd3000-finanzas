import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { Profile } from '@/types'

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  // isMounted prevents state updates after unmount (React 18 StrictMode safe).
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true

    // Single source of truth for auth state.
    // INITIAL_SESSION fires once on subscribe with the current session (or null).
    // Subsequent events (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED) update accordingly.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!isMounted.current) return

        if (event === 'SIGNED_OUT') {
          setSession(null)
          setProfile(null)
          setLoading(false)
          return
        }

        setSession(currentSession)

        if (currentSession?.user) {
          await loadProfile(currentSession.user.id)
        } else {
          if (isMounted.current) setProfile(null)
        }

        // After INITIAL_SESSION completes (with or without session) unlock the UI.
        // For other events, loading is already false — this is a no-op.
        if (event === 'INITIAL_SESSION' && isMounted.current) {
          setLoading(false)
        }
      }
    )

    return () => {
      isMounted.current = false
      subscription.unsubscribe()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadProfile(userId: string): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (!isMounted.current) return

      if (error) {
        // Profile query failed (e.g. network, RLS). Session stays valid — show
        // dashboard with limited profile data rather than triggering a signout loop.
        console.warn('[AUTH] Profile load error:', error.code, error.message)
        setProfile(null)
      } else {
        // Set profile as-is, including when active=false.
        // ProtectedRoute handles active=false by showing a "cuenta desactivada"
        // screen — NOT by redirecting to /login, which would create a login loop.
        setProfile(data as Profile)
      }
    } catch (err) {
      if (isMounted.current) {
        console.warn('[AUTH] Profile load exception:', err)
        setProfile(null)
      }
    }
  }

  async function signIn(email: string, password: string): Promise<{ error: Error | null }> {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error as Error | null }
  }

  async function signOut(): Promise<void> {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      profile,
      loading,
      signIn,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
