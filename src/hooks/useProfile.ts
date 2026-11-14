import { useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/authContext'
import { useAsyncData } from './useAsyncData'
import { mergeApprovedMemberPhotos } from '../utils/memberPhotoDisplay'
import { toProfileDetail, type GetProfileRow } from '../utils/profileDetail'
import type { ProfileDetail } from '../types'

/**
 * One member's full public profile for /profile/:id.
 *
 * Reads the `get_profile` RPC, which returns *no rows* for a target who is
 * hidden, paused, banned, blocked in either direction, the caller themselves,
 * or simply missing — so a successful-but-`null` result is the uninformative
 * 404 state, and the page must not guess which of those it was.
 */
export function useProfile(profileId: string | undefined) {
  const { user } = useAuth()

  const load = useCallback(async () => {
    if (!user || !profileId) return { data: null, error: null }

    const { data, error } = await supabase.rpc('get_profile', { target_id: profileId })

    if (error) return { data: null, error: error.message }

    const row = (data ?? [])[0] as GetProfileRow | undefined
    if (!row) return { data: null, error: null }

    const detail = toProfileDetail(row)
    const merged = await mergeApprovedMemberPhotos([detail as ProfileDetail])
    if (merged[0]) {
      detail.photos = merged[0].photos
    }

    return { data: detail, error: null }
  }, [user, profileId])

  return useAsyncData<ProfileDetail | null>(load)
}