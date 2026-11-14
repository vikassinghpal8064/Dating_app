import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { getAppOrigin } from '../lib/appOrigin'
import type { EditableProfileFields, SignUpData } from '../lib/authContext'
import type { AuthState, UserProfile } from '../types'

/** The fixed redirect target for password reset: a path, never a caller URL. */
const PASSWORD_RESET_PATH = '/auth/reset-password'
/** The route that exchanges OAuth / email-link callbacks for a session. */
const AUTH_CALLBACK_PATH = '/auth/callback'

/*
 * Mirrors the signed-in user id so actions can read it without depending on
 * the state snapshot, which would make every callback change identity each
 * render.
 */
let cachedUserId: string | null = null

export type SignUpResult = { error: Error | null; requiresEmailVerification: boolean }

interface AuthStore extends AuthState {
  /** Internal state writes. `loading` must only ever be touched at init. */
  setAuth: (fields: Partial<AuthState>) => void
  resetAuth: () => void
  fetchProfile: (userId: string) => Promise<void>
  refreshProfile: () => Promise<void>
  signUp: (data: SignUpData) => Promise<SignUpResult>
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: Error | null }>
  updateProfile: (data: EditableProfileFields) => Promise<{ error: Error | null }>
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  session: null,
  loading: true,
  error: null,

  setAuth: (fields) => set(fields),

  resetAuth: () => {
    cachedUserId = null
    set({ user: null, session: null, error: null, loading: false })
  },

  fetchProfile: async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw error

      // The number of photos in the member's own upload set, so the
      // two-photo completeness requirement can count uploads + pasted URLs
      // even though `profiles.photos` only holds the pasted URLs.
      const { count: photosCount, error: countError } = await supabase
        .from('member_photos')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)

      if (countError) throw countError

      const profile = { ...(data as UserProfile), photos_count: photosCount ?? 0 }
      cachedUserId = profile.id

      set({
        user: profile,
        session: (await supabase.auth.getSession()).data.session,
        loading: false,
        error: null,
      })
    } catch (error) {
      set((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch profile',
      }))
    }
  },

  refreshProfile: async () => {
    if (cachedUserId) await get().fetchProfile(cachedUserId)
  },

  signUp: async (data) => {
    try {
      const {
        data: authData,
        error: authError,
      } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          /*
           * The `on_auth_user_created` trigger writes the profile and default
           * preferences row server-side, so this is where the collected data
           * must travel: with email confirmation on, GoTrue returns no
           * session, and the client cannot write those rows itself (its anon
           * key is denied by RLS by design). The trigger hydrates the profile
           * from this metadata; bio and interests are deliberately not sent,
           * so the fresh member is routed to /onboarding to finish them.
           */
          data: {
            full_name: data.fullName,
            date_of_birth: data.dateOfBirth,
            gender: data.gender,
            interested_in: data.interestedIn,
            location_city: data.locationCity,
            location_country: data.locationCountry,
          },
          emailRedirectTo: `${getAppOrigin()}${AUTH_CALLBACK_PATH}`,
        },
      })

      if (authError) throw authError
      if (!authData.user) throw new Error('Sign up failed')

      // When email confirmation is enabled GoTrue returns a user with no
      // session: the account exists, but nothing is signed in until the link
      // is followed.
      const requiresEmailVerification = authData.session === null

      if (authData.session?.user) {
        await get().fetchProfile(authData.session.user.id)
      }

      return { error: null, requiresEmailVerification }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Sign up failed')
      return { error: err, requiresEmailVerification: false }
    }
  },

  /*
   * `signIn` and `signUp` deliberately never touch `state.loading`.
   *
   * `loading` means one thing only: "the initial session lookup has not
   * resolved yet". The route guards block on it, so flipping it while a
   * request is in flight swaps the sign-in form out for the guard's spinner
   * and back again — which unmounts the form, discards the error it was about
   * to show, and silently drops what the user typed. In-flight state belongs
   * to the form that owns it; the failure is returned to the caller, which
   * renders it.
   */
  signIn: async (email, password) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) throw error

      return { error: null }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Sign in failed')
      return { error: err }
    }
  },

  signOut: async () => {
    cachedUserId = null
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  },

  resetPassword: async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${getAppOrigin()}${PASSWORD_RESET_PATH}`,
    })
    return { error: error ? new Error(error.message) : null }
  },

  updateProfile: async (data) => {
    const userId = cachedUserId
    if (!userId) return { error: new Error('Not authenticated') }

    try {
      const { error } = await supabase.from('profiles').update(data).eq('id', userId)

      if (error) throw error

      await get().refreshProfile()
      return { error: null }
    } catch (error) {
      return { error: error instanceof Error ? error : new Error('Update failed') }
    }
  },
}))

/**
 * A stable reference to the store's action bag, for callers that need the
 * functions without subscribing to state (context providers, callbacks).
 */
export function getAuthActions() {
  return {
    signUp: useAuthStore.getState().signUp,
    signIn: useAuthStore.getState().signIn,
    signOut: useAuthStore.getState().signOut,
    resetPassword: useAuthStore.getState().resetPassword,
    updateProfile: useAuthStore.getState().updateProfile,
    refreshProfile: useAuthStore.getState().refreshProfile,
    fetchProfile: useAuthStore.getState().fetchProfile,
    resetAuth: useAuthStore.getState().resetAuth,
    setAuth: useAuthStore.getState().setAuth,
  }
}