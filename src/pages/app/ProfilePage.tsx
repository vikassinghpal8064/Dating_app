import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, MapPin, Shield } from 'lucide-react'
import {
  Avatar,
  Badge,
  Chip,
  PageContainer,
  ProfileEmptyState,
  QueryState,
} from '../../components/ui'
import { useProfile } from '../../hooks/useDiscover'
import { formatDistance, formatRelativeTime } from '../../utils'

const GENDER_LABELS: Record<string, string> = {
  male: 'Man',
  female: 'Woman',
  non_binary: 'Non-binary',
  prefer_not_to_say: 'Prefer not to say',
  everyone: 'Everyone',
}

export function ProfilePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data, status, error, reload } = useProfile(id)

  return (
    <PageContainer variant="narrow">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-6 inline-flex items-center gap-2 rounded-lg text-sm text-dark-400 transition-colors hover:text-dark-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back
      </button>

      <QueryState
        status={status}
        error={error}
        onRetry={reload}
        label="this profile"
        isEmpty={status === 'success' && !data}
        empty={<ProfileEmptyState onAction={() => navigate('/app/discover')} />}
      >
        {data && (
          <article className="glass-strong rounded-2xl p-6 sm:p-8">
            <header className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
              <Avatar
                src={data.photos[0] ?? null}
                fallback={data.full_name}
                alt={`${data.full_name}’s profile photo`}
                size="2xl"
                status={data.is_online ? 'online' : 'offline'}
              />
              <div className="min-w-0">
                <h1 className="font-display text-2xl sm:text-3xl font-bold text-dark-50">
                  {data.full_name}, {data.age}
                </h1>
                <p className="mt-1 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-dark-400 sm:justify-start">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" aria-hidden="true" />
                    {[data.location_city, data.location_country].filter(Boolean).join(', ')}
                  </span>
                  {data.distance_km != null && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{formatDistance(data.distance_km)}</span>
                    </>
                  )}
                </p>
                <p className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  {data.gender && (
                    <Badge variant="default" size="sm">
                      {GENDER_LABELS[data.gender] ?? data.gender}
                    </Badge>
                  )}
                  <Badge variant={data.is_online ? 'online' : 'default'} size="sm">
                    {data.is_online ? 'Online now' : `Active ${formatRelativeTime(data.last_active)}`}
                  </Badge>
                </p>
              </div>
            </header>

            {data.photos.length > 0 && (
              <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {data.photos.slice(0, 6).map((photo, index) => (
                  <li key={photo}>
                    <img
                      src={photo}
                      alt={`${data.full_name}, photo ${index + 1}`}
                      loading="lazy"
                      className="aspect-square w-full rounded-xl object-cover ring-1 ring-dark-700"
                    />
                  </li>
                ))}
              </ul>
            )}

            <section className="mt-8">
              <h2 className="font-display text-lg font-semibold text-dark-50">About</h2>
              <p className="mt-2 whitespace-pre-line leading-relaxed text-dark-300">
                {data.bio?.trim() ? data.bio : 'They have not written a bio yet.'}
              </p>
            </section>

            {data.interested_in.length > 0 && (
              <section className="mt-8">
                <h2 className="font-display text-lg font-semibold text-dark-50">Interested in</h2>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {data.interested_in.map((interest) => (
                    <li key={interest}>
                      <Chip variant="outline" size="sm">
                        {GENDER_LABELS[interest] ?? interest}
                      </Chip>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <p className="mt-8 flex items-start gap-2 rounded-xl border border-dark-700 bg-dark-900/60 p-3 text-xs leading-relaxed text-dark-400">
              <Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary-400" aria-hidden="true" />
              <span>
                You are seeing only what this person chose to share. Their email address, phone
                number and exact location are never exposed to you.
              </span>
            </p>

            <div className="mt-6">
              <Link
                to="/app/messages"
                className="text-sm text-primary-400 underline underline-offset-2"
              >
                Messaging unlocks once you have matched
              </Link>
            </div>
          </article>
        )}
      </QueryState>
    </PageContainer>
  )
}
