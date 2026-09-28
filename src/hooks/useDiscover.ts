import { useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/authContext'
import { useAsyncData } from './useAsyncData'
import type { PublicProfile } from '../types'
import type { Database } from '../types/database'

type PublicProfileRow = Database['public']['Views']['public_profiles']['Row']

/** Narrows the view row to the shape the UI consumes. */
function toPublicProfile(row: PublicProfileRow): PublicProfile {
  return {
    id: row.id,
    full_name: row.full_name,
    age: row.age,
    gender: row.gender,
    interested_in: row.interested_in ?? [],
    bio: row.bio ?? '',
    photos: row.photos ?? [],
    location_city: row.location_city,
    location_country: row.location_country,
    distance_km: row.distance_km,
    is_online: row.is_online,
    last_active: row.last_active,
  }
}

/**
 * Candidate profiles for the signed-in user.
 *
 * Reads through the `public_profiles` view so the browser never selects email,
 * coordinates or phone numbers from `profiles`, and the distance returned is
 * only used to pick a coarse display band.
 */
export function useDiscoverProfiles(limit = 20) {
  const { user } = useAuth()

  const load = useCallback(async () => {
    if (!user) return { data: null, error: null }

    const { data, error } = await supabase.rpc('get_potential_matches', {
      user_id: user.id,
      limit_count: limit,
      offset_count: 0,
    })

    if (error) return { data: null, error: error.message }

    return {
      data: ((data ?? []) as PublicProfileRow[]).map(toPublicProfile),
      error: null,
    }
  }, [user, limit])

  return useAsyncData<PublicProfile[]>(load)
}

/** A single person's public profile, by id. */
export function useProfile(profileId: string | undefined) {
  const load = useCallback(async () => {
    if (!profileId) return { data: null, error: null }

    const { data, error } = await supabase
      .from('public_profiles')
      .select('*')
      .eq('id', profileId)
      .maybeSingle()

    if (error) return { data: null, error: error.message }
    if (!data) return { data: null, error: 'That profile could not be found.' }

    return { data: toPublicProfile(data as PublicProfileRow), error: null }
  }, [profileId])

  return useAsyncData<PublicProfile>(load)
}
