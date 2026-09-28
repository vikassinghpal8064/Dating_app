import { useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/authContext'
import { useAsyncData } from './useAsyncData'
import type { Match, Message, PublicProfile } from '../types'
import type { Database } from '../types/database'

type MatchRow = Database['public']['Tables']['matches']['Row']
type PublicProfileRow = Database['public']['Views']['public_profiles']['Row']
type MessageRow = Database['public']['Tables']['messages']['Row']

const PARTNER_COLUMNS = `
  id, full_name, age, gender, interested_in, bio, photos,
  location_city, location_country, distance_km, is_online, last_active
`

/*
 * The `matches` table stores a pair in a canonical order — `user_id` is always
 * the lexicographically smaller uuid — so there is no "left" and "right" member.
 * Which of the two columns holds the other person therefore depends on the row,
 * not on the viewer.
 *
 * Both foreign keys are embedded and the partner is picked by excluding the
 * signed-in user's own id. Embedding only one of them would render the viewer's
 * own profile as their match for roughly half of all rows.
 */
const MATCH_COLUMNS = `
  id,
  user_id,
  matched_user_id,
  created_at,
  last_message_at,
  lower_id_profile:public_profiles!matches_user_id_fkey (${PARTNER_COLUMNS}),
  higher_id_profile:public_profiles!matches_matched_user_id_fkey (${PARTNER_COLUMNS})
`

interface MatchSelectRow extends MatchRow {
  lower_id_profile: PublicProfileRow | PublicProfileRow[] | null
  higher_id_profile: PublicProfileRow | PublicProfileRow[] | null
}

/** PostgREST returns an embedded to-one relation as an object or a 1-item array. */
function first(value: PublicProfileRow | PublicProfileRow[] | null): PublicProfileRow | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

/** The stub used when a matched account has since been deleted. */
function deletedAccount(matchId: string, fallbackId: string, createdAt: string): PublicProfile {
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
    last_active: createdAt,
  }
}

/** Builds the UI shape for a match, tolerating a missing embedded profile. */
function toMatch(row: MatchSelectRow, viewerId: string): Match {
  // The view never returns the viewer, so whichever embed came back is the
  // partner; both being null means the other account is gone or hidden.
  const person = first(row.lower_id_profile) ?? first(row.higher_id_profile)

  return {
    id: row.id,
    user_id: row.user_id,
    matched_user_id: row.matched_user_id,
    created_at: row.created_at,
    unread_count: 0,
    // Surfacing a blank card would be worse than naming what happened, so a
    // missing embedded row is reported as a deleted account.
    matched_user:
      person ??
      deletedAccount(
        row.id,
        row.user_id === viewerId ? row.matched_user_id : row.user_id,
        row.created_at,
      ),
  }
}

/** Everyone the signed-in user has matched with, newest activity first. */
export function useMatches() {
  const { user } = useAuth()

  const load = useCallback(async () => {
    if (!user) return { data: null, error: null }

    const { data, error } = await supabase
      .from('matches')
      .select(MATCH_COLUMNS)
      .order('last_message_at', { ascending: false, nullsFirst: false })

    if (error) return { data: null, error: error.message }

    return {
      data: ((data ?? []) as MatchSelectRow[]).map((row) => toMatch(row, user.id)),
      error: null,
    }
  }, [user])

  return useAsyncData<Match[]>(load)
}

/** The message history for one match. */
export function useMessages(matchId: string | undefined) {
  const load = useCallback(async () => {
    if (!matchId) return { data: null, error: null }

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('match_id', matchId)
      .order('created_at', { ascending: true })
      .limit(200)

    if (error) return { data: null, error: error.message }

    const rows = (data ?? []) as MessageRow[]

    return {
      data: rows.map<Message>((row) => ({
        id: row.id,
        match_id: row.match_id,
        sender_id: row.sender_id,
        content: row.content,
        message_type: row.message_type,
        read_at: row.read_at,
        created_at: row.created_at,
      })),
      error: null,
    }
  }, [matchId])

  return useAsyncData<Message[]>(load)
}

/** Sends a message. RLS rejects it if the sender is not part of the match. */
export async function sendMessage(matchId: string, content: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You need to be signed in to send a message.' }

  const { error } = await supabase.from('messages').insert({
    match_id: matchId,
    sender_id: user.id,
    content,
    message_type: 'text',
  })

  return { error: error ? error.message : null }
}
