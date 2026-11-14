import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MessageSquare, MoreHorizontal, Trash2 } from 'lucide-react'
import {
  Avatar,
  Button,
  MatchesEmptyState,
  Modal,
  PageContainer,
  PageHeader,
  QueryState,
  useToast,
} from '../../components/ui'
import { useMatches, unmatchMember } from '../../hooks/useMatches'
import type { Match } from '../../types'

function previewFor(match: Match): string {
  if (match.last_message) return match.last_message
  return 'Say hi to start the conversation'
}

/**
 * /matches — every mutual match, newest activity first, with the latest message
 * preview and an unread counter per thread. Unmatching deletes the thread for
 * both members; the row is removed optimistically and restored on failure.
 */
export function MatchesPage() {
  const navigate = useNavigate()
  const { data, status, error, reload } = useMatches()
  const toast = useToast()

  // Copy of the list so an optimistic unmatch can remove a row immediately.
  const [items, setItems] = useState<Match[] | null>(null)
  const [unmatching, setUnmatching] = useState<Match | null>(null)
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    if (status === 'success') setItems(data ?? [])
  }, [status, data])

  const matches = items ?? data ?? []

  const confirmUnmatch = async () => {
    if (!unmatching || removing) return
    const name = unmatching.matched_user.full_name
    const removedId = unmatching.id

    setRemoving(true)
    // Optimistic: drop the row right away, restore from the server on failure.
    setItems((prev) => (prev ?? []).filter((match) => match.id !== removedId))
    const outcome = await unmatchMember(removedId)
    setRemoving(false)

    if (outcome.error) {
      toast.addToast({ title: 'Could not unmatch', description: outcome.error, type: 'error' })
      await reload()
    } else {
      toast.addToast({ title: 'Unmatched', description: `You and ${name} are no longer matched.`, type: 'success' })
    }
    setUnmatching(null)
  }

  return (
    <PageContainer>
      <PageHeader
        title="Matches"
        subtitle="People who liked you back. Only the two of you can see this list."
      />

      <QueryState
        status={status}
        error={error}
        onRetry={reload}
        label="matches"
        isEmpty={matches.length === 0}
        empty={<MatchesEmptyState onAction={() => navigate('/app/discover')} />}
      >
        <ul className="space-y-3">
          {matches.map((match) => {
            const name = match.matched_user.full_name
            const unread = match.unread_count > 0
            return (
              <li key={match.id}>
                <div className="glass-strong flex items-center gap-3 rounded-2xl p-3">
                  <Link
                    to={`/app/messages/${match.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                    aria-label={`Chat with ${name}${unread ? `, ${match.unread_count} unread ${match.unread_count === 1 ? 'message' : 'messages'}` : ''}`}
                  >
                    <span className="relative shrink-0">
                      <Avatar src={match.matched_user.photos[0] ?? null} fallback={name} size="lg" />
                      {match.matched_user.is_online && (
                        <span
                          className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-dark-950"
                          aria-label="Online now"
                        />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className={`truncate font-display text-base ${unread ? 'font-bold text-dark-50' : 'font-semibold text-dark-100'}`}>
                          {name}, {match.matched_user.age}
                        </span>
                        {unread && (
                          <span
                            className="shrink-0 rounded-full bg-primary-600 px-2 py-0.5 text-xs font-bold text-white"
                            aria-label={`${match.unread_count} unread ${match.unread_count === 1 ? 'message' : 'messages'}`}
                          >
                            {match.unread_count > 99 ? '99+' : match.unread_count}
                          </span>
                        )}
                      </span>
                      <span
                        className={`mt-0.5 flex items-center gap-1.5 truncate text-sm ${unread ? 'text-dark-200' : 'text-dark-500'}`}
                      >
                        <MessageSquare className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span className="truncate">{previewFor(match)}</span>
                      </span>
                    </span>
                  </Link>

                  <button
                    type="button"
                    onClick={() => setUnmatching(match)}
                    aria-label={`More options for ${name}`}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-dark-400 transition-colors hover:bg-dark-800 hover:text-dark-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  >
                    <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </QueryState>

      <Modal
        isOpen={unmatching !== null}
        onClose={() => (removing ? undefined : setUnmatching(null))}
        title={unmatching ? `Unmatch with ${unmatching.matched_user.full_name}?` : 'Unmatch?'}
      >
        <p className="text-sm leading-relaxed text-dark-300">
          The conversation and all its messages will be deleted for both of you, and
          the match will be gone for good. This cannot be undone.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setUnmatching(null)} disabled={removing}>
            Cancel
          </Button>
          <button
            type="button"
            onClick={() => void confirmUnmatch()}
            disabled={removing}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-glow transition-all hover:bg-red-700 active:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-dark-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            {removing ? 'Unmatching…' : 'Unmatch'}
          </button>
        </div>
      </Modal>
    </PageContainer>
  )
}