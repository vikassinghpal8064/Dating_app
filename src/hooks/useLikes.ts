import { useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/authContext'
import { useAsyncData } from './useAsyncData'
import { mergeApprovedMemberPhotos } from '../utils/memberPhotoDisplay'
import type { PublicProfile } from '../types'
import type { Database } from '../types/database'

type LikesViewRow = {
  age: number | null
  bio: string | null
  distance_km: number | null
  full_name: string | null
  gender: string | null
  interested_in: string[] | null
  is_online: boolean | null
  last_active: string | null
  like_type: Database['public']['Enums']['like_type'] | null
  liked_at: string | null
  location_city: string | null
  location_country: string | null
  photos: string[] | null
  /** `likes_received` carries the liker, `likes_sent` the liked member. */
  liker_id?: string | null
  liked_id?: string | null
}

export type LikesDirection = 'received' | 'sent'

export interface LikesEntry {
  profile: PublicProfile
  like_type: 'like' | 'super_like'
  liked_at: string
}

/** Normalises either likes view into a `PublicProfile` (the id column differs). */
function toLikesProfile(row: LikesViewRow, idColumn: 'liker_id' | 'liked_id'): PublicProfile {
  return {
    id: row[idColumn] ?? '',
    full_name: row.full_name ?? '',
    age: row.age ?? 0,
    gender: row.gender ?? '',
    interested_in: row.interested_in ?? [],
    bio: row.bio ?? '',
    photos: row.photos ?? [],
    location_city: row.location_city ?? '',
    location_country: row.location_country ?? '',
    distance_km: row.distance_km,
    is_online: row.is_online ?? false,
    last_active: row.last_active ?? '',
  }
}

/**
 * One of the two /likes lists. `received` reads the `likes_received` view
 * (people who liked the caller, as public profiles), `sent` reads the new
 * `likes_sent` mirror. Both go through `public_profiles`, so a target who is
 * hidden, banned or blocked never surfaces in either list.
 */
export function useLikes(direction: LikesDirection) {
  const { user } = useAuth()

  const load = useCallback(async () => {
    if (!user) return { data: null, error: null }

    const table = direction === 'received' ? 'likes_received' : 'likes_sent'
    const idColumn = direction === 'received' ? 'liker_id' : 'liked_id'

    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order('liked_at', { ascending: false })

    if (error) return { data: null, error: error.message }

    const rows = (data ?? []) as LikesViewRow[]

    const entries: LikesEntry[] = rows.map((row) => ({
      profile: toLikesProfile(row, idColumn),
      like_type: (row.like_type ?? 'like') as 'like' | 'super_like',
      liked_at: row.liked_at ?? '',
    }))

    const merged = await mergeApprovedMemberPhotos(entries.map((entry) => entry.profile))
    for (let i = 0; i < entries.length; i++) {
      entries[i] = { ...entries[i], profile: merged[i] ?? entries[i].profile }
    }

    return { data: entries, error: null }
  }, [user, direction])

  return useAsyncData<LikesEntry[]>(load)
}