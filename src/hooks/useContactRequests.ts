import { useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/authContext'
import { useAsyncData } from './useAsyncData'

export type ContactRequestStatus = 'pending' | 'approved' | 'declined'

/** One incoming request as the owner's settings page renders it. */
export interface IncomingContactRequest {
  id: string
  requesterId: string
  requesterName: string | null
  status: ContactRequestStatus
  createdAt: string
}

const POLL_MS = 30_000

/**
 * The requests other members have made for the signed-in member's number.
 *
 * Read through RLS as the owner, so only rows whose `owner_id` is the caller
 * come back. Requester names are pulled from the public_profiles view in a
 * second call — the raw profiles table is own-row-only, and requesting names
 * through the view keeps the number itself out of every request.
 */
export function useContactRequests() {
  const { user } = useAuth()

  const load = useCallback(async () => {
    if (!user) return { data: null, error: null }

    const { data, error } = await supabase
      .from('contact_requests')
      .select('id, requester_id, status, created_at')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })

    if (error) return { data: null, error: error.message }

    const rows = data ?? []
    const requesterIds = [...new Set(rows.map((row) => row.requester_id))]
    const names: Record<string, string> = {}
    if (requesterIds.length > 0) {
      const { data: profiles } = await supabase
        .from('public_profiles')
        .select('id, full_name')
        .in('id', requesterIds)
      for (const profile of profiles ?? []) {
        if (profile.full_name) names[profile.id] = profile.full_name
      }
    }

    const incoming: IncomingContactRequest[] = rows.map((row) => ({
      id: row.id,
      requesterId: row.requester_id,
      requesterName: names[row.requester_id] ?? null,
      status: row.status,
      createdAt: row.created_at,
    }))

    return { data: incoming, error: null }
  }, [user])

  const state = useAsyncData<IncomingContactRequest[]>(load)
  const { reload } = state

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') reload()
    }
    document.addEventListener('visibilitychange', onVisible)
    const timer = window.setInterval(reload, POLL_MS)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(timer)
    }
  }, [reload])

  const respond = useCallback(
    async (requestId: string, approve: boolean) => {
      const { error } = await supabase.rpc('respond_contact_request', {
        p_request: requestId,
        p_approve: approve,
      })
      if (!error) reload()
      return { ok: !error, error: error?.message ?? null }
    },
    [reload]
  )

  return { ...state, respond }
}

/**
 * The number of unanswered requests, for the settings-gear dot in the layout.
 * A head-only count query so the badge costs nothing to keep fresh.
 */
export function usePendingContactRequestCount() {
  const { user } = useAuth()

  const load = useCallback(async () => {
    if (!user) return { data: null, error: null }

    const { count, error } = await supabase
      .from('contact_requests')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', user.id)
      .eq('status', 'pending')

    if (error) return { data: null, error: error.message }
    return { data: count ?? 0, error: null }
  }, [user])

  const state = useAsyncData<number>(load)
  const { reload } = state

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') reload()
    }
    document.addEventListener('visibilitychange', onVisible)
    const timer = window.setInterval(reload, POLL_MS)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(timer)
    }
  }, [reload])

  return state
}