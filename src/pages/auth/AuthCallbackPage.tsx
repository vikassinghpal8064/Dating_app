import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'

/**
 * Terminal for OAuth and email-link redirects.
 *
 * The Supabase client exchanges the `code` in the URL as soon as the bundle
 * loads (`detectSessionInUrl`), so by the time this page mounts the session
 * usually already exists. Its only job is to wait for the profile the auth
 * subscription will fetch, then send the member into the app — where
 * `ProtectedRoute` decides between Discover and Onboarding based on profile
 * completeness.
 */
export function AuthCallbackPage() {
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false

    const finish = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (cancelled) return

      if (!session?.user) {
        navigate('/auth/login', { replace: true })
        return
      }

      // The onAuthStateChange subscription fetches the profile too, but this
      // page may win that race; fetch it explicitly so the guard never renders
      // a half-signed-in state.
      const { user } = useAuthStore.getState()
      if (!user || user.id !== session.user.id) {
        await useAuthStore.getState().fetchProfile(session.user.id)
      }

      if (cancelled) return
      navigate('/app/discover', { replace: true })
    }

    void finish()

    return () => {
      cancelled = true
    }
  }, [navigate])

  return (
    <div className="space-y-6 text-center animate-fade-in" role="status">
      <div className="w-16 h-16 rounded-full bg-primary-600/10 flex items-center justify-center mx-auto">
        <RefreshCw className="w-8 h-8 text-primary-400 animate-spin" aria-hidden="true" />
      </div>
      <div>
        <h1 className="font-display text-xl font-semibold text-dark-50">Completing sign-in</h1>
        <p className="mt-2 text-dark-400 text-sm">One moment while we finish setting you up…</p>
      </div>
    </div>
  )
}