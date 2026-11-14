import { useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/authContext'
import { useAsyncData } from './useAsyncData'

export interface UnreadStats {
  /** Incoming likes the caller has not reciprocated (not yet matches). */
  newLikes: number
  /** Received messages that have not been marked read. */
  unreadMessages: number
}

const POLL_MS = 30_000

/**
 * The nav badge numbers (new likes, unread messages) for the signed-in member.
 *
 * Refreshes on mount, whenever the window regains focus, and every 30s while
 * mounted — the badge lives in the layout, so this covers the whole session
 * without wiring refresh calls through every mutating action.
 */
export function useUnreadStats() {
  const { user } = useAuth()

  const load = useCallback(async () => {
    if (!user) return { data: null, error: null }

    const { data, error } = await supabase.rpc('unread_stats')

    if (error) return { data: null, error: error.message }

    const row = (data ?? [])[0]
    if (!row) return { data: { newLikes: 0, unreadMessages: 0 }, error: null }

    return {
      data: { newLikes: row.new_likes, unreadMessages: row.unread_messages },
      error: null,
    }
  }, [user])

  const state = useAsyncData<UnreadStats>(load)
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