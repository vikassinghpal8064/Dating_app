import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/authContext'
import { toSearchProfile, withApprovedPhotos } from '../utils/search'
import type { AsyncStatus } from './useAsyncData'
import type { Database } from '../types/database'
import type { LikeActionResult, SearchProfile } from '../types'

const PAGE_SIZE = 10

export type DeckDirection = 'left' | 'right' | 'up'
export type DeckKind = 'pass' | 'like' | 'super'

const KIND_FOR_DIRECTION: Record<DeckDirection, DeckKind> = {
  left: 'pass',
  right: 'like',
  up: 'super',
}

/**
 * The /discover swipe deck. Owns the candidate queue and every write the deck
 * can make (like, pass, block, report). The page animates the swipe and then
 * calls `consume` to advance; if the API call fails the card stays put.
 */
export function useDeck() {
  const { user } = useAuth()
  const [queue, setQueue] = useState<SearchProfile[]>([])
  const [status, setStatus] = useState<AsyncStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const requestId = useRef(0)

  const loadPage = useCallback(
    async (offset: number) => {
      const current = ++requestId.current
      const { data, error: rpcError } = await supabase.rpc('get_discover_candidates', {
        limit_count: PAGE_SIZE,
        offset_count: offset,
      })
      if (requestId.current !== current) return null
      if (rpcError) return rpcError
      const rows = (data ?? []).map(toSearchProfile)
      return { rows: await withApprovedPhotos(rows) }
    },
    []
  )

  const load = useCallback(async () => {
    if (!user) {
      setQueue([])
      setStatus('success')
      setHasMore(false)
      return
    }
    setStatus('loading')
    setError(null)
    const outcome = await loadPage(0)
    if (outcome === null) return
    if ('rows' in outcome) {
      setQueue(outcome.rows)
      setHasMore(outcome.rows.length === PAGE_SIZE)
      setStatus('success')
    } else {
      setError(outcome.message)
      setStatus('error')
    }
  }, [user, loadPage])

  const applied = useRef(false)
  useEffect(() => {
    if (applied.current) return
    applied.current = true
    void load()
  }, [load])

  const reload = useCallback(() => {
    applied.current = true
    void load()
  }, [load])

  const loadMore = useCallback(async () => {
    if (loadingMore || status !== 'success' || !hasMore) return
    setLoadingMore(true)
    const outcome = await loadPage(queue.length)
    setLoadingMore(false)
    if (outcome === null) return
    if ('rows' in outcome) {
      setQueue((prev) => [...prev, ...outcome.rows])
      setHasMore(outcome.rows.length === PAGE_SIZE)
    }
  }, [hasMore, loadPage, loadingMore, queue.length, status])

  const consume = useCallback((profileId: string) => {
    setQueue((prev) => prev.filter((profile) => profile.id !== profileId))
  }, [])

  /** Records a like or a pass. `send_like` reports whether this was mutual. */
  const act = useCallback(
    async (profileId: string, kind: DeckKind): Promise<LikeActionResult> => {
      if (!user) return { ok: false, error: 'Signed out', matched: false, matchId: null, createdAt: null }
      if (kind === 'pass') {
        const { error: passError } = await supabase.rpc('send_pass', { target_user_id: profileId })
        return passError
          ? { ok: false, error: passError.message, matched: false, matchId: null, createdAt: null }
          : { ok: true, error: null, matched: false, matchId: null, createdAt: null }
      }

      const { data, error: likeError } = await supabase.rpc('send_like', {
        target_user_id: profileId,
        like_kind: kind === 'super' ? 'super_like' : 'like',
      })

      if (likeError) {
        return { ok: false, error: likeError.message, matched: false, matchId: null, createdAt: null }
      }
      const row = (data ?? [])[0]
      return {
        ok: true,
        error: null,
        matched: row?.matched ?? false,
        matchId: row?.match_id ?? null,
        createdAt: row?.created_at ?? null,
      }
    },
    [user]
  )

  /** Two-way block via the existing table API; the card leaves the deck. */
  const block = useCallback(
    async (profileId: string): Promise<{ ok: boolean; error: string | null }> => {
      if (!user) return { ok: false, error: 'Signed out' }
      const { error: blockError } = await supabase.from('blocks').insert({
        blocker_id: user.id,
        blocked_id: profileId,
      })
      if (blockError) return { ok: false, error: blockError.message }
      consume(profileId)
      return { ok: true, error: null }
    },
    [user, consume]
  )

  /** Files a report (the member never sees who reported them). */
  const report = useCallback(
    async (
      profileId: string,
      reason: Database['public']['Enums']['report_reason'],
      details: string
    ): Promise<{ ok: boolean; error: string | null }> => {
      if (!user) return { ok: false, error: 'Signed out' }
      const { error: reportError } = await supabase.from('reports').insert({
        reporter_id: user.id,
        reported_id: profileId,
        reason,
        details: details.trim() === '' ? null : details.trim(),
      })
      if (reportError) return { ok: false, error: reportError.message }
      consume(profileId)
      return { ok: true, error: null }
    },
    [user, consume]
  )

  return {
    queue,
    status,
    error,
    reload,
    loadMore,
    hasMore,
    loadingMore,
    consume,
    act,
    block,
    report,
    KIND_FOR_DIRECTION,
  }
}