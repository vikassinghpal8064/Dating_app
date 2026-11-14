import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Heart, Star, X } from 'lucide-react'
import { Avatar, Button, Chip, PageContainer, PageHeader, QueryState, useToast } from '../../components/ui'
import { MatchModal } from '../../components/discover/MatchModal'
import { useLikes, type LikesDirection, type LikesEntry } from '../../hooks/useLikes'
import { useDeck, type DeckKind } from '../../hooks/useDeck'
import { formatDistance, distanceBucket } from '../../utils/distance'
import type { SearchProfile } from '../../types'

const TABS: { id: LikesDirection; label: string }[] = [
  { id: 'received', label: 'Liked you' },
  { id: 'sent', label: 'You liked' },
]

/** Adapter so the shared match modal can consume a likes-list profile. */
function toSearchProfile(entry: LikesEntry): SearchProfile {
  const p = entry.profile
  return {
    id: p.id,
    full_name: p.full_name,
    age: p.age,
    gender: p.gender,
    interested_in: p.interested_in,
    bio: p.bio,
    photos: p.photos,
    location_city: p.location_city,
    location_country: p.location_country,
    is_online: p.is_online,
    last_active: p.last_active,
    distance_bucket: distanceBucket(p.distance_km)?.id ?? null,
    is_verified: false,
    looking_for: 'unsure',
    interests: [],
    height_cm: null,
  }
}

/**
 * /likes — two tabs: the people who liked the caller, and the people the
 * caller liked. Both lists come from views that render *people* (never bare
 * ids) and hide targets who are hidden, banned or blocked.
 */
export function LikesPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<LikesDirection>('received')
  const likes = useLikes(tab)
  const { act } = useDeck()
  const toast = useToast()

  const [busyId, setBusyId] = useState<string | null>(null)
  const [match, setMatch] = useState<{ profile: SearchProfile; matchId: string } | null>(null)

  const entries = likes.data ?? []

  const runAction = async (entry: LikesEntry, kind: DeckKind) => {
    if (busyId) return
    setBusyId(entry.profile.id)
    const outcome = await act(entry.profile.id, kind)
    setBusyId(null)
    likes.reload()

    if (!outcome.ok) {
      toast.addToast({ title: 'That could not be sent', description: outcome.error ?? undefined, type: 'error' })
      return
    }
    if (outcome.matched && outcome.matchId) {
      setMatch({ profile: toSearchProfile(entry), matchId: outcome.matchId })
      toast.addToast({ title: "It's a match!", description: `${entry.profile.full_name} liked you back.`, type: 'success' })
      return
    }
    toast.addToast({
      title: kind === 'pass' ? 'Passed' : kind === 'super' ? 'Super Liked' : 'Liked',
      description: `${entry.profile.full_name} ${kind === 'pass' ? 'was passed' : kind === 'super' ? 'was super liked' : 'was liked'}.`,
      type: kind === 'pass' ? 'info' : 'success',
    })
  }

  const emptyState =
    tab === 'received' ? (
      <div className="glass rounded-2xl p-8 text-center">
        <h2 className="font-display text-xl font-semibold text-dark-50">No likes yet</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-dark-400">
          Members who like you will appear here. Get your profile out there first.
        </p>
        <Button className="mt-5" onClick={() => navigate('/app/discover')}>
          Start discovering
        </Button>
      </div>
    ) : (
      <div className="glass rounded-2xl p-8 text-center">
        <h2 className="font-display text-xl font-semibold text-dark-50">Nothing sent yet</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-dark-400">
          When you like someone, they show up here so you can keep track.
        </p>
        <Button className="mt-5" onClick={() => navigate('/app/discover')}>
          Start discovering
        </Button>
      </div>
    )

  return (
    <PageContainer variant="narrow">
      <PageHeader title="Likes" subtitle="People who like you, and people you have liked." />

      <div role="tablist" aria-label="Likes lists" className="mb-5 flex gap-1 rounded-xl border border-dark-800 bg-dark-900 p-1">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
              tab === item.id ? 'bg-primary-600/20 text-primary-300' : 'text-dark-400 hover:text-dark-200'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <QueryState
        status={likes.status}
        error={likes.error}
        onRetry={likes.reload}
        label="likes"
        isEmpty={entries.length === 0}
        empty={emptyState}
      >
        <ul
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          role="tabpanel"
          aria-label={tab === 'received' ? 'People who liked you' : 'People you liked'}
        >
          {entries.map((entry) => (
            <li key={entry.profile.id} className="glass-strong rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <Avatar src={entry.profile.photos[0] ?? null} fallback={entry.profile.full_name} size="lg" />
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/app/profile/${entry.profile.id}`}
                    className="block truncate rounded font-display text-base font-semibold text-dark-50 transition-colors hover:text-primary-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  >
                    {entry.profile.full_name}, {entry.profile.age}
                  </Link>
                  <p className="mt-0.5 text-xs text-dark-500">
                    {entry.profile.location_city} &middot; {formatDistance(entry.profile.distance_km)}
                  </p>
                  <p className="mt-0.5 text-xs text-dark-500">
                    {tab === 'received' ? 'Liked you' : 'You liked'} &middot; {formatWhen(entry.liked_at)}
                  </p>
                </div>
              </div>

              {tab === 'received' ? (
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void runAction(entry, 'pass')}
                    disabled={busyId === entry.profile.id}
                    aria-label={`Pass on ${entry.profile.full_name}`}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-red-500/40 bg-dark-900 text-red-400 transition-colors hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-45"
                  >
                    <X className="h-5 w-5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void runAction(entry, 'like')}
                    disabled={busyId === entry.profile.id}
                    aria-label={`Like ${entry.profile.full_name} back`}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-primary-500/50 bg-dark-900 text-primary-400 transition-colors hover:bg-primary-600/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-45"
                  >
                    <Heart className="h-5 w-5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void runAction(entry, 'super')}
                    disabled={busyId === entry.profile.id}
                    aria-label={`Super like ${entry.profile.full_name}`}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-amber-400/40 bg-dark-900 text-amber-400 transition-colors hover:bg-amber-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-45"
                  >
                    <Star className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <Link
                  to={`/app/profile/${entry.profile.id}`}
                  className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-primary-600/15 px-4 py-2 text-sm font-medium text-primary-300 transition-colors hover:bg-primary-600/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                  View profile
                </Link>
              )}
            </li>
          ))}
          {entries.length > 0 && (
            <li className="flex items-center justify-center rounded-2xl border border-dashed border-dark-800 p-4 text-center text-xs text-dark-500">
              <Chip>Only you can see this list</Chip>
            </li>
          )}
        </ul>
      </QueryState>

      <MatchModal
        open={match !== null}
        profile={match?.profile ?? null}
        onSendMessage={() => {
          if (!match) return
          const matchId = match.matchId
          setMatch(null)
          navigate(`/app/messages/${matchId}`)
        }}
        onKeepSwiping={() => setMatch(null)}
      />
    </PageContainer>
  )
}

function formatWhen(iso: string): string {
  if (!iso) return 'recently'
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days < 1) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}