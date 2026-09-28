import { useNavigate } from 'react-router-dom'
import { Info, Shield } from 'lucide-react'
import {
  DiscoverEmptyState,
  PageContainer,
  PageHeader,
  ProfileCard,
  QueryState,
} from '../../components/ui'
import { useDiscoverProfiles } from '../../hooks/useDiscover'

export function DiscoverPage() {
  const navigate = useNavigate()
  const { data, status, error, reload } = useDiscoverProfiles()

  const profiles = data ?? []

  return (
    <PageContainer>
      <PageHeader
        title="Discover"
        subtitle="People who match your preferences. Open a profile to see the full picture."
      />

      <QueryState
        status={status}
        error={error}
        onRetry={reload}
        label="profiles"
        isEmpty={profiles.length === 0}
        empty={<DiscoverEmptyState onAction={() => navigate('/app/search')} />}
      >
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {profiles.map((profile) => (
            <li key={profile.id}>
              <ProfileCard
                profile={profile}
                showActions={false}
                onViewProfile={() => navigate(`/app/profile/${profile.id}`)}
              />
            </li>
          ))}
        </ul>
      </QueryState>

      <aside className="mt-10 flex items-start gap-3 rounded-2xl border border-dark-700 bg-dark-900/60 p-4 text-sm text-dark-300">
        <Shield className="mt-0.5 h-5 w-5 shrink-0 text-primary-400" aria-hidden="true" />
        <div>
          <p className="font-medium text-dark-100">Liking is not wired up yet</p>
          <p className="mt-1 leading-relaxed">
            Swiping writes a <code className="text-primary-300">likes</code> row, and that table is
            not part of the database yet. Rather than ship a button that silently does nothing, this
            build lets you browse and open profiles.{' '}
            <button
              type="button"
              onClick={() => navigate('/app/search')}
              className="text-primary-400 underline underline-offset-2"
            >
              Refine your search
            </button>{' '}
            in the meantime.
          </p>
        </div>
      </aside>

      <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-dark-500">
        <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
        Distances are shown as bands, never as an exact location.
      </p>
    </PageContainer>
  )
}
