import { useNavigate } from 'react-router-dom'
import { MatchesEmptyState, PageContainer, PageHeader, ProfileCard, QueryState } from '../../components/ui'
import { useMatches } from '../../hooks/useMatches'

export function MatchesPage() {
  const navigate = useNavigate()
  const { data, status, error, reload } = useMatches()

  const matches = data ?? []

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
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {matches.map((match) => (
            <li key={match.id}>
              <ProfileCard
                profile={match.matched_user}
                variant="match"
                onViewProfile={() => navigate(`/app/messages/${match.id}`)}
              />
            </li>
          ))}
        </ul>
      </QueryState>
    </PageContainer>
  )
}
