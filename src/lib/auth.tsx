import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from './supabase'
import { AuthContext } from './authContext'
import type { EditableProfileFields, SignUpData } from './authContext'
import type { AuthState, UserProfile } from '../types'

/** The redirect target is a fixed relative path, never a caller-supplied URL. */
const PASSWORD_RESET_PATH = '/auth/reset-password'

function getAppOrigin(): string {
  return import.meta.env.VITE_APP_URL || window.location.origin
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    error: null,
  })

  /* Mirrors the signed-in user id so callbacks can read it without depending
     on `state`, which would make every callback change identity each render. */
  const userIdRef = useRef<string | null>(null)

  /* Only depends on the stable `setState`, so `useCallback` makes it safe to
     list as an effect dependency. */
  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw error

      const profile = data as UserProfile
      userIdRef.current = profile.id

      setState({
        user: profile,
        session: (await supabase.auth.getSession()).data.session,
        loading: false,
        error: null,
      })
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch profile',
      }))
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    const userId = userIdRef.current
    if (userId) await fetchProfile(userId)
  }, [fetchProfile])

  useEffect(() => {
    let mounted = true

    const initializeAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!mounted) return

      if (session?.user) {
        await fetchProfile(session.user.id)
      } else {
        setState((prev) => ({ ...prev, loading: false }))
      }
    }

    void initializeAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return

      if (session?.user) {
        await fetchProfile(session.user.id)
      } else {
        userIdRef.current = null
        setState({ user: null, session: null, loading: false, error: null })
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [fetchProfile])

  const signUp = async (data: SignUpData) => {
    try {
      const {
        data: authData,
        error: authError,
      } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: { data: { full_name: data.fullName } },
      })

      if (authError) throw authError
      if (!authData.user) throw new Error('Sign up failed')

      /*
       * An `on_auth_user_created` trigger has already created the profile row
       * for this id, so this is an upsert rather than an insert.
       *
       * The payload is deliberately restricted to columns a member may write:
       * no `email` (it is mirrored from auth.users by the same trigger, so
       * sending it would only give a client a way to overwrite it) and no
       * `age_verified` / `phone_verified` (both default to false, and the
       * database grants no insert or update privilege on them at all).
       */
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(
          {
            id: authData.user.id,
            full_name: data.fullName,
            date_of_birth: data.dateOfBirth,
            gender: data.gender,
            interested_in: data.interestedIn,
            location_city: data.locationCity,
            location_country: data.locationCountry,
            bio: '',
            photos: [],
            show_distance: true,
            whatsapp_consent: false,
          },
          { onConflict: 'id' },
        )

      if (profileError) throw profileError

      // The sign-up trigger seeds this row too, so it is written as an upsert.
      const { error: prefsError } = await supabase.from('user_preferences').upsert(
        {
          user_id: authData.user.id,
          min_age: 18,
          max_age: 99,
          max_distance_km: 50,
          show_me_to: 'everyone',
          notifications: {
            new_match: true,
            new_message: true,
            whatsapp_request: true,
            profile_liked: true,
          },
          privacy: {
            show_distance: true,
            show_online_status: true,
            show_last_active: true,
          },
        },
        { onConflict: 'user_id' },
      )

      if (prefsError) throw prefsError

      await fetchProfile(authData.user.id)

      return { error: null }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Sign up failed')
      return { error: err }
    }
  }

  /*
   * `signIn` and `signUp` deliberately never touch `state.loading`.
   *
   * `loading` means one thing only: "the initial session lookup has not
   * resolved yet". The route guards block on it, so flipping it while a request
   * is in flight swaps the sign-in form out for the guard's spinner and back
   * again — which unmounts the form, discards the error it was about to show,
   * and silently drops what the user typed. In-flight state belongs to the form
   * that owns it; the failure is returned to the caller, which renders it.
   */
  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) throw error

      return { error: null }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Sign in failed')
      return { error: err }
    }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${getAppOrigin()}${PASSWORD_RESET_PATH}`,
    })
    return { error: error ? new Error(error.message) : null }
  }

  const updateProfile = async (data: EditableProfileFields) => {
    const userId = userIdRef.current
    if (!userId) return { error: new Error('Not authenticated') }

    try {
      const { error } = await supabase.from('profiles').update(data).eq('id', userId)

      if (error) throw error

      await refreshProfile()
      return { error: null }
    } catch (error) {
      return { error: error instanceof Error ? error : new Error('Update failed') }
    }
  }

  return (
    <AuthContext.Provider
      value={{ ...state, signUp, signIn, signOut, resetPassword, updateProfile, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  )
}
