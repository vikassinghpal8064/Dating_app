import { useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import { supabase } from './supabase'
import { AuthContext } from './authContext'
import { getAuthActions, useAuthStore } from '../stores/authStore'

/**
 * Binds the Supabase auth lifecycle to the global zustand auth store.
 *
 * All auth logic (session init, profile sync, sign up / in / out, password
 * reset, profile updates) lives in `stores/authStore.ts`; this component is
 * only the adapter that turns Supabase's event stream into store writes, and
 * the Context that hands stable action references to `useAuth()` consumers.
 * Keeping the actions stable is what lets every page unmount-and-remount on
 * a state change without surprising side effects.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const user = useAuthStore((state) => state.user)
  const session = useAuthStore((state) => state.session)
  const loading = useAuthStore((state) => state.loading)
  const error = useAuthStore((state) => state.error)
  const actions = useMemo(() => getAuthActions(), [])

  useEffect(() => {
    let mounted = true

    const initializeAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!mounted) return

      if (session?.user) {
        await useAuthStore.getState().fetchProfile(session.user.id)
      } else {
        useAuthStore.getState().setAuth({ loading: false })
      }
    }

    void initializeAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return

      if (session?.user) {
        await useAuthStore.getState().fetchProfile(session.user.id)
      } else {
        useAuthStore.getState().resetAuth()
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const value = useMemo(
    () => ({ user, session, loading, error, ...actions }),
    [user, session, loading, error, actions],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}