import { useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/authContext'
import { useAsyncData } from './useAsyncData'
import { toPublicProfile } from '../utils/publicProfile'
import { mergeApprovedMemberPhotos } from '../utils/memberPhotoDisplay'
import type { PublicProfile } from '../types'
import type { Database } from '../types/database'

type PublicProfileRow = Database['public']['Views']['public_profiles']['Row']

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

    const profiles = ((data ?? []) as PublicProfileRow[]).map(toPublicProfile)
    return {
      data: await mergeApprovedMemberPhotos(profiles),
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

    const [profile] = await mergeApprovedMemberPhotos([toPublicProfile(data as PublicProfileRow)])
    return { data: profile ?? null, error: null }
  }, [profileId])

  return useAsyncData<PublicProfile>(load)
}
