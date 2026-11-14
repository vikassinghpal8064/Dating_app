import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageSquare, Search } from 'lucide-react'
import {
  Avatar,
  EmptyState,
  PageContainer,
  PageHeader,
  QueryState,
  Skeleton,
} from '../../components/ui'
import { useMatches } from '../../hooks/useMatches'
import { formatRelativeTime } from '../../utils'

export function MessagesPage() {
  const navigate = useNavigate()
  const { data, status, error, reload } = useMatches()
  const [search, setSearch] = useState('')

  const matches = useMemo(() => data ?? [], [data])

  // Filter by search
  const filtered = useMemo(() => {
    if (!search.trim()) return matches
    const query = search.toLowerCase()
    return matches.filter((match) => match.matched_user.full_name.toLowerCase().includes(query))
  }, [matches, search])

  return (
    <PageContainer variant="narrow">
      <PageHeader
        title="Messages"
        subtitle="Conversations with your matches. Row-level security keeps every thread private to its two members."
      />

      {/* Search */}
      {matches.length > 0 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-500" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations…"
            className="w-full rounded-xl border border-dark-700 bg-dark-900 py-2.5 pl-10 pr-4 text-sm text-dark-50 placeholder-dark-500 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            aria-label="Search conversations"
          />
        </div>
      )}

      <QueryState
        status={status}
        error={error}
        onRetry={reload}
        label="conversations"
        isEmpty={filtered.length === 0}
        empty={
          <EmptyState
            icon={<MessageSquare className="h-10 w-10 text-primary-500" aria-hidden="true" />}
            title={search ? 'No matches found' : 'No conversations yet'}
            description={
              search
                ? `No conversations match "${search}"`
                : 'Match with someone first — you cannot message anybody else.'
            }
            action={
              !search
                ? { label: 'Start discovering', onClick: () => navigate('/app/discover') }
                : undefined
            }
          />
        }
      >
        {status === 'loading' ? (
          <ul className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i}>
                <div className="flex items-center gap-4 rounded-2xl border border-dark-700 bg-dark-900/60 p-4">
                  <Skeleton className="h-14 w-14 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="space-y-3">
            {filtered.map((match) => {
              const person = match.matched_user
              const unreadCount = match.unread_count ?? 0

              return (
                <li key={match.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/app/messages/${match.id}`)}
                    className="flex w-full items-center gap-4 rounded-2xl border border-dark-700 bg-dark-900/60 p-4 text-left transition-colors hover:border-dark-600 hover:bg-dark-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  >
                    <Avatar
                      src={person.photos[0] ?? null}
                      fallback={person.full_name}
                      alt={`${person.full_name}'s profile photo`}
                      size="lg"
                      status={person.is_online ? 'online' : 'offline'}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="block truncate font-medium text-dark-50">
                          {person.full_name}
                          {person.age > 0 && `, ${person.age}`}
                        </span>
                        {match.last_message_at && (
                          <span className="shrink-0 text-xs text-dark-500">
                            {formatRelativeTime(match.last_message_at)}
                          </span>
                        )}
                      </span>
                      <span className="flex items-center justify-between gap-2">
                        <span className="block truncate text-sm text-dark-400">
                          {match.last_message ||
                            (person.bio?.trim()
                              ? person.bio
                              : person.is_online
                                ? 'Online now'
                                : `Active ${formatRelativeTime(person.last_active)}`)}
                        </span>
                        {unreadCount > 0 && (
                          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary-600 px-1.5 text-xs font-medium text-white">
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </QueryState>
    </PageContainer>
  )
}
