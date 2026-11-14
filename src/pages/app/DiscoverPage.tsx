import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, Star, X } from 'lucide-react'
import { useDeck } from '../../hooks/useDeck'
import type { DeckDirection } from '../../hooks/useDeck'
import { CardActions } from '../../components/discover/CardActions'
import { DeckBackCard, SwipeCard } from '../../components/discover/SwipeCard'
import { MatchModal } from '../../components/discover/MatchModal'
import {
  Button,
  DiscoverEmptyState,
  InlineMessage,
  PageContainer,
  PageHeader,
  PageSpinner,
} from '../../components/ui'
import type { Database } from '../../types/database'
import type { SearchProfile } from '../../types'

type ReportReason = Database['public']['Enums']['report_reason']

/**
 * /discover — the swipe deck. Drag left/right/up or use ← → ↑ / the buttons;
 * every action is a database write through `useDeck`, so the daily like limit
 * is enforced server-side and a failed fling returns the card to the deck.
 */
export function DiscoverPage() {
  const navigate = useNavigate()
  const {
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
  } = useDeck()

  const [flying, setFlying] = useState<{ profileId: string; direction: DeckDirection } | null>(null)
  const [match, setMatch] = useState<{ profile: SearchProfile; matchId: string | null } | null>(null)
  const [menuProfile, setMenuProfile] = useState<SearchProfile | null>(null)
  const [swipeError, setSwipeError] = useState<string | null>(null)
  const busyRef = useRef(false)

  // Top-up the queue before the deck runs dry.
  useEffect(() => {
    if (status === 'success' && queue.length < 3 && hasMore && !loadingMore) {
      void loadMore()
    }
  }, [queue.length, status, hasMore, loadingMore, loadMore])

  const decide = useCallback((profileId: string, direction: DeckDirection) => {
    if (busyRef.current) return
    busyRef.current = true
    setSwipeError(null)
    setFlying({ profileId, direction })
  }, [])

  const handleFlingDone = useCallback(
    async (profileId: string, direction: DeckDirection) => {
      const profile = queue.find((candidate) => candidate.id === profileId) ?? null
      const result = await act(profileId, KIND_FOR_DIRECTION[direction])
      if (result.ok) {
        consume(profileId)
        setFlying(null)
        if (result.matched && profile) {
          setMatch({ profile, matchId: result.matchId })
        }
      } else {
        setFlying(null)
        setSwipeError(result.error ?? 'That did not go through — try again.')
      }
      busyRef.current = false
    },
    [act, consume, queue, KIND_FOR_DIRECTION]
  )

  const handleDragRelease = useCallback(
    (profileId: string, direction: DeckDirection | null) => {
      if (direction) decide(profileId, direction)
    },
    [decide]
  )

  const handleBlock = useCallback(async () => {
    if (!menuProfile) return
    const result = await block(menuProfile.id)
    if (!result.ok) throw new Error(result.error ?? 'Could not block this member')
    setMenuProfile(null)
  }, [menuProfile, block])

  const handleReport = useCallback(
    async (reason: ReportReason, details: string) => {
      if (!menuProfile) return
      const result = await report(menuProfile.id, reason, details)
      if (!result.ok) throw new Error(result.error ?? 'Could not send the report')
      setMenuProfile(null)
    },
    [menuProfile, report]
  )

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const current = queue[0]
    if (!current) return
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      decide(current.id, 'left')
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      decide(current.id, 'right')
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      decide(current.id, 'up')
    }
  }

  const current = queue[0] ?? null
  const isLoading = (status === 'idle' || status === 'loading') && queue.length === 0
  const isEmpty = status === 'success' && queue.length === 0 && !loadingMore

  const sendMessage = () => {
    if (match?.matchId) {
      navigate(`/app/messages/${match.matchId}`)
    } else {
      setMatch(null)
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Discover"
        subtitle="Swipe right to like, left to pass, up to super like. Matches unlock messaging."
      />

      {isLoading ? (
        <div className="flex flex-col items-center gap-4 py-20">
          <PageSpinner size="lg" variant="primary" />
          <p className="text-sm text-dark-400">Loading your deck…</p>
        </div>
      ) : status === 'error' && queue.length === 0 ? (
        <div className="mt-4 space-y-4" role="alert">
          <InlineMessage tone="error">
            Your deck could not be loaded{error ? `: ${error}` : '.'}
          </InlineMessage>
          <Button variant="outline" size="sm" onClick={reload}>
            Try again
          </Button>
        </div>
      ) : isEmpty ? (
        <DiscoverEmptyState onAction={() => navigate('/app/search')} />
      ) : (
        <div
          className="mx-auto mt-2 w-full max-w-sm"
          onKeyDown={handleKeyDown}
          tabIndex={0}
          aria-label="Swipe deck. Use the left, right and up arrow keys, drag the card, or use the buttons below."
        >
          {swipeError && (
            <div className="mb-4">
              <InlineMessage tone="error">{swipeError}</InlineMessage>
            </div>
          )}

          <div className="relative h-[540px] sm:h-[580px]">
            {queue.slice(1, 3).map((profile, index) => (
              <DeckBackCard key={profile.id} profile={profile} depth={index + 1} />
            ))}

            {current && (
              <SwipeCard
                key={current.id}
                profile={current}
                isTop
                flying={flying}
                onFlingDone={(profileId, direction) => void handleFlingDone(profileId, direction)}
                onDragRelease={handleDragRelease}
                onOpenMenu={() => setMenuProfile(current)}
              />
            )}
          </div>

          {/* Action buttons */}
          <div className="mt-8 flex items-center justify-center gap-5">
            <button
              type="button"
              aria-label={`Pass on ${current ? current.full_name : 'the next member'}`}
              disabled={!current}
              onClick={() => current && decide(current.id, 'left')}
              className="flex h-14 w-14 items-center justify-center rounded-full border border-dark-600 bg-dark-900 text-red-400 transition-all hover:scale-105 hover:border-red-400 hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-40 disabled:hover:scale-100"
            >
              <X className="h-6 w-6" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={`Super like ${current ? current.full_name : 'the next member'}`}
              disabled={!current}
              onClick={() => current && decide(current.id, 'up')}
              className="flex h-16 w-16 items-center justify-center rounded-full border border-accent-gold/60 bg-accent-gold/10 text-accent-gold shadow-glow transition-all hover:scale-105 hover:bg-accent-gold/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-40 disabled:hover:scale-100"
            >
              <Star className="h-7 w-7" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={`Like ${current ? current.full_name : 'the next member'}`}
              disabled={!current}
              onClick={() => current && decide(current.id, 'right')}
              className="flex h-14 w-14 items-center justify-center rounded-full border border-primary-500 bg-primary-600/20 text-primary-400 transition-all hover:scale-105 hover:bg-primary-600/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-40 disabled:hover:scale-100"
            >
              <Heart className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>

          <p className="mt-4 text-center text-xs text-dark-500">
            Drag a card, press ← → ↑, or tap a button. Up to 100 likes a day.
          </p>
        </div>
      )}

      {menuProfile && (
        <CardActions
          profile={menuProfile}
          open
          onClose={() => setMenuProfile(null)}
          onReport={handleReport}
          onBlock={handleBlock}
        />
      )}

      <MatchModal
        open={match !== null}
        profile={match?.profile ?? null}
        onSendMessage={sendMessage}
        onKeepSwiping={() => setMatch(null)}
      />
    </PageContainer>
  )
}