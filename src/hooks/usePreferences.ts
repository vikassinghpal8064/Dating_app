import { useCallback, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/authContext'
import { useAsyncData } from './useAsyncData'
import type { UserPreferences } from '../types'
import type { Database } from '../types/database'

type PreferencesRow = Database['public']['Tables']['user_preferences']['Row']

const DEFAULTS: UserPreferences = {
  user_id: '',
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
}

function toPreferences(row: PreferencesRow): UserPreferences {
  return {
    user_id: row.user_id,
    min_age: row.min_age,
    max_age: row.max_age,
    max_distance_km: row.max_distance_km,
    show_me_to: row.show_me_to,
    notifications: {
      ...DEFAULTS.notifications,
      ...(row.notifications as Partial<UserPreferences['notifications']> | null),
    },
    privacy: {
      ...DEFAULTS.privacy,
      ...(row.privacy as Partial<UserPreferences['privacy']> | null),
    },
  }
}

/** The signed-in user's discovery, notification and privacy preferences. */
export function usePreferences() {
  const { user } = useAuth()
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const load = useCallback(async () => {
    if (!user) return { data: null, error: null }

    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) return { data: null, error: error.message }
    if (!data) {
      // No row yet — fall back to the documented defaults rather than an error,
      // so a fresh account still has a usable settings screen.
      return { data: { ...DEFAULTS, user_id: user.id }, error: null }
    }

    return { data: toPreferences(data as PreferencesRow), error: null }
  }, [user])

  const state = useAsyncData<UserPreferences>(load)

  const save = useCallback(
    async (next: UserPreferences) => {
      if (!user) return { error: 'You need to be signed in.' }

      setSaving(true)
      setSaveError(null)

      const { error } = await supabase.from('user_preferences').upsert({
        user_id: user.id,
        min_age: next.min_age,
        max_age: next.max_age,
        max_distance_km: next.max_distance_km,
        show_me_to: next.show_me_to,
        notifications: next.notifications,
        privacy: next.privacy,
      })

      setSaving(false)

      if (error) {
        setSaveError(error.message)
        return { error: error.message }
      }

      setSavedAt(Date.now())
      state.reload()
      return { error: null }
    },
    // `state.reload` is a stable useCallback.
    [user, state]
  )

  return { ...state, save, saving, saveError, savedAt }
}
