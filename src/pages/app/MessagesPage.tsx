import { useNavigate } from 'react-router-dom'
import { MessageSquare } from 'lucide-react'
import {
  Avatar,
  Button,
  EmptyState,
  PageContainer,
  PageHeader,
  QueryState,
} from '../../components/ui'
import { useMatches } from '../../hooks/useMatches'
import { formatRelativeTime } from '../../utils'

export function MessagesPage() {
  const navigate = useNavigate()
  const { data, status, error, reload } = useMatches()

  const matches = data ?? []

  return (
    <PageContainer variant="narrow">
      <PageHeader
        title="Messages"
        subtitle="Conversations with your matches. Row-level security keeps every thread private to its two members."
      />

      <QueryState
        status={status}
        error={error}
        onRetry={reload}
        label="conversations"
        isEmpty={matches.length === 0}
        empty={
          <EmptyState
            icon={<MessageSquare className="w-10 h-10 text-primary-500" aria-hidden="true" />}
            title="No conversations yet"
            description="Match with someone first — you cannot message anybody else."
            action={{ label: 'Start discovering', onClick: () => navigate('/app/discover') }}
          />
        }
      >
        <ul className="space-y-3">
          {matches.map((match) => {
            const person = match.matched_user

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
                    alt={`${person.full_name}’s profile photo`}
                    size="lg"
                    status={person.is_online ? 'online' : 'offline'}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-dark-50">
                      {person.full_name}
                      {person.age > 0 && `, ${person.age}`}
                    </span>
                    <span className="block truncate text-sm text-dark-400">
                      {person.bio?.trim()
                        ? person.bio
                        : person.is_online
                          ? 'Online now'
                          : `Active ${formatRelativeTime(person.last_active)}`}
                    </span>
                  </span>
                  <MessageSquare className="h-5 w-5 shrink-0 text-dark-500" aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ul>

        <div className="mt-8 flex justify-center">
          <Button variant="outline" onClick={() => navigate('/app/matches')}>
            View all matches
          </Button>
        </div>
      </QueryState>
    </PageContainer>
  )
}
