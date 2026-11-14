import { useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/authContext'
import { useAsyncData } from './useAsyncData'
import { mergeApprovedMemberPhotos } from '../utils/memberPhotoDisplay'
import type { Match, PublicProfile } from '../types'
import type { Database } from '../types/database'

type ListMatchesRow = Database['public']['Functions']['list_matches']['Returns'][number]

/** The `partner` composite PostgREST returns for each match. */
type PartnerRow = NonNullable<ListMatchesRow['partner']>

/** Maps the partner composite to the shared `PublicProfile` shape. */
function toPartnerProfile(partner: PartnerRow): PublicProfile {
  return {
    id: partner.id ?? '',
    full_name: partner.full_name ?? '',
    age: partner.age ?? 0,
    gender: partner.gender ?? '',
    interested_in: partner.interested_in ?? [],
    bio: partner.bio ?? '',
    photos: partner.photos ?? [],
    location_city: partner.location_city ?? '',
    location_country: partner.location_country ?? '',
    distance_km: partner.distance_km,
    is_online: partner.is_online ?? false,
    last_active: partner.last_active ?? '',
  }
}

/** The stub used when a matched account has since gone (defensive; the RPC
 * normally drops those matches entirely). */
function deletedAccount(fallbackId: string): PublicProfile {
  return {
    id: fallbackId,
    full_name: 'Deleted account',
    age: 0,
    gender: '',
    interested_in: [],
    bio: '',
    photos: [],
    location_city: '',
    location_country: '',
    distance_km: null,
    is_online: false,
    last_active: '',
  }
}

/** Builds the UI shape for one `list_matches` row. */
function toMatch(row: ListMatchesRow, viewerId: string): Match {
  const partner = row.partner

  return {
    id: row.match_id,
    user_id: viewerId,
    // The RPC resolves the partner, so the canonical-order columns are not
    // returned; the UI reads `matched_user`, never the raw pair.
    matched_user_id: partner?.id ?? viewerId,
    created_at: row.created_at,
    last_message_at: row.last_message_at ?? undefined,
    last_message: row.last_message,
    unread_count: row.unread_count,
    matched_user: partner !== null ? toPartnerProfile(partner) : deletedAccount(viewerId),
  }
}

/** Everyone the signed-in user has matched with, newest activity first. */
export function useMatches() {
  const { user } = useAuth()

  const load = useCallback(async () => {
    if (!user) return { data: null, error: null }

    const { data, error } = await supabase.rpc('list_matches')

    if (error) return { data: null, error: error.message }

    const rows = (data ?? []) as ListMatchesRow[]
    const matches = rows.map((row) => toMatch(row, user.id))

    // Photos come from two places — the member's approved uploads (private
    // bucket, needs signed URLs) and pasted https URLs on the profile.
    if (matches.length > 0) {
      const merged = await mergeApprovedMemberPhotos(matches.map((match) => match.matched_user))
      for (let i = 0; i < matches.length; i++) {
        matches[i] = { ...matches[i], matched_user: merged[i] ?? matches[i].matched_user }
      }
    }

    return { data: matches, error: null }
  }, [user])

  return useAsyncData<Match[]>(load)
}

/** Ends the match and deletes the thread for both members. Idempotent. */
export async function unmatchMember(matchId: string) {
  const { error } = await supabase.rpc('unmatch', { p_match_id: matchId })
  return { error: error ? error.message : null }
}