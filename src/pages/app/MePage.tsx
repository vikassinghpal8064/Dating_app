import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Compass, Heart, MapPin, MessageSquare, Pen, Shield } from 'lucide-react'
import { Avatar, Badge, Chip, PageContainer, PageHeader, Toggle, useToast } from '../../components/ui'
import { useAuth } from '../../lib/authContext'
import { useMatches } from '../../hooks/useMatches'
import { useMemberPhotos } from '../../hooks/useMemberPhotos'
import { MIN_PROFILE_PHOTOS } from '../../utils/profileCompleteness'

const GENDER_LABELS: Record<string, string> = {
  male: 'Man',
  female: 'Woman',
  non_binary: 'Non-binary',
  prefer_not_to_say: 'Prefer not to say',
  everyone: 'Everyone',
}

/** What a complete profile needs before it can do any work for you. */
const COMPLETENESS_CHECKS: { key: 'bio' | 'photos' | 'location' | 'interestedIn'; label: string }[] = [
  { key: 'bio', label: 'Write a bio' },
  { key: 'photos', label: `Add at least ${MIN_PROFILE_PHOTOS} photos` },
  { key: 'location', label: 'Set your city' },
  { key: 'interestedIn', label: 'Say who you are interested in' },
]

export function MePage() {
  const { user, updateProfile } = useAuth()
  const { data: matches, status: matchesStatus } = useMatches()
  const { photos: ownPhotos } = useMemberPhotos()
  const toast = useToast()

  const [paused, setPaused] = useState(user?.profile_paused ?? false)
  const [pausing, setPausing] = useState(false)

  // Keep the toggle in sync once the profile (re)loads.
  useEffect(() => {
    setPaused(user?.profile_paused ?? false)
  }, [user?.profile_paused])

  const togglePause = async (next: boolean) => {
    if (pausing) return
    setPausing(true)
    setPaused(next) // optimistic
    const { error } = await updateProfile({ profile_paused: next })
    setPausing(false)

    if (error) {
      setPaused(!next) // rollback
      toast.addToast({ title: 'Could not update visibility', description: error.message, type: 'error' })
      return
    }
    toast.addToast({
      title: next ? 'Profile paused' : 'Profile visible again',
      description: next
        ? 'You are hidden from discovery and search until you unpause.'
        : 'You are visible to other members again.',
      type: next ? 'info' : 'success',
    })
  }

  const matchCount = matches?.length

  // Photos come from two sources: the member's uploads (`member_photos`,
  // signed URLs for rendering) and pasted https URLs on the profile row.
  // Uploads take display priority, matching every other surface.
  const displayPhotos = [
    ...ownPhotos.map((photo) => photo.signedUrl).filter((url): url is string => Boolean(url)),
    ...(user?.photos ?? []),
  ]
  const photoTotal = (user?.photos?.length ?? 0) + (user?.photos_count ?? 0)

  const checks: Record<(typeof COMPLETENESS_CHECKS)[number]['key'], boolean> = {
    bio: Boolean(user?.bio?.trim()),
    photos: photoTotal >= MIN_PROFILE_PHOTOS,
    location: Boolean(user?.location_city?.trim()),
    interestedIn: (user?.interested_in?.length ?? 0) > 0,
  }

  const completed = COMPLETENESS_CHECKS.filter((check) => checks[check.key]).length
  const percent = Math.round((completed / COMPLETENESS_CHECKS.length) * 100)

  const location = [user?.location_city, user?.location_country].filter(Boolean).join(', ')

  return (
    <PageContainer variant="narrow">
      <PageHeader title="Me" subtitle="Your profile, as other people see it." />

      <article className="glass rounded-2xl p-6">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:text-left">
          <Avatar
            src={displayPhotos[0] ?? null}
            fallback={user?.full_name ?? '?'}
            alt="Your profile photo"
            size="2xl"
          />
          <div className="min-w-0">
            <h2 className="font-display text-2xl font-bold text-dark-50">
              {user?.full_name ?? 'Your profile'}
            </h2>
            {location && (
              <p className="mt-1 flex items-center justify-center gap-1.5 text-dark-400 sm:justify-start">
                <MapPin className="h-4 w-4" aria-hidden="true" />
                {location}
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <Badge variant={user?.age_verified ? 'verified' : 'default'} size="sm">
                <Shield className="h-3 w-3" aria-hidden="true" />
                {user?.age_verified ? '18+ verified' : 'Age not verified'}
              </Badge>
              {user?.phone_verified && (
                <Badge variant="verified" size="sm">
                  <Shield className="h-3 w-3" aria-hidden="true" />
                  Phone verified
                </Badge>
              )}
            </div>
          </div>
        </div>

        <p className="mt-6 whitespace-pre-line leading-relaxed text-dark-300">
          {user?.bio?.trim() ? user.bio : 'You have not written a bio yet.'}
        </p>

        {user?.interested_in && user.interested_in.length > 0 && (
          <ul className="mt-5 flex flex-wrap justify-center gap-2 sm:justify-start">
            {user.interested_in.map((interest) => (
              <li key={interest}>
                <Chip variant="outline" size="sm">
                  Interested in {GENDER_LABELS[interest] ?? interest}
                </Chip>
              </li>
            ))}
          </ul>
        )}
      </article>

      <nav aria-label="Quick actions" className="mt-6 grid gap-3 sm:grid-cols-3">
        <Link
          to="/app/me/edit"
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-dark-700 bg-dark-900/60 px-4 py-3 font-medium text-dark-100 transition hover:border-primary-500/40 hover:bg-dark-800/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-400"
        >
          <Pen className="h-4 w-4" aria-hidden="true" />
          Edit profile
        </Link>
        <Link
          to="/app/discover"
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary-600 to-primary-700 px-4 py-3 font-medium text-white transition hover:from-primary-500 hover:to-primary-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-400"
        >
          <Compass className="h-4 w-4" aria-hidden="true" />
          Discover
        </Link>
        <Link
          to="/app/messages"
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-dark-700 bg-dark-900/60 px-4 py-3 font-medium text-dark-100 transition hover:border-primary-500/40 hover:bg-dark-800/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-400"
        >
          <MessageSquare className="h-4 w-4" aria-hidden="true" />
          Messages
        </Link>
      </nav>

      <section className="glass mt-6 rounded-2xl p-5">
        <h2 className="font-display text-lg font-semibold text-dark-50">Profile visibility</h2>
        <p className="mt-1 text-sm text-dark-400">
          Pause your profile to hide it from discovery, search and other profiles. Nothing is
          deleted — your existing matches and chats stay exactly as they are.
        </p>
        <div className="mt-4 rounded-xl border border-dark-700 bg-dark-900/60 p-4">
          <Toggle
            id="profile-pause"
            checked={paused}
            disabled={pausing}
            onChange={(event) => void togglePause(event.target.checked)}
            label={paused ? 'Profile is paused' : 'Profile is visible'}
            description={
              paused
                ? 'No one new can see you. Flip this any time to come back.'
                : 'Other members can find you in discovery and search.'
            }
          />
        </div>
      </section>

      <section className="glass mt-6 rounded-2xl p-5">
        <h2 className="font-display text-lg font-semibold text-dark-50">Profile strength</h2>
        <p className="mt-1 text-sm text-dark-400">
          {completed} of {COMPLETENESS_CHECKS.length} complete. Everything else on HeartConnect is
          driven off these fields.
        </p>

        <div
          className="mt-4 h-2 overflow-hidden rounded-full bg-dark-800"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Profile completeness"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-600"
            style={{ width: `${percent}%` }}
          />
        </div>

        <ul className="mt-5 space-y-2">
          {COMPLETENESS_CHECKS.map((check) => {
            const done = checks[check.key]
            return (
              <li key={check.key} className="flex items-center gap-3 text-sm">
                <span
                  className={
                    done
                      ? 'flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400'
                      : 'flex h-5 w-5 items-center justify-center rounded-full border border-dark-600'
                  }
                  aria-hidden="true"
                >
                  {done ? '✓' : ''}
                </span>
                <span className={done ? 'text-dark-300' : 'text-dark-400'}>{check.label}</span>
                <span className="sr-only">{done ? '(done)' : '(not done)'}</span>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="glass mt-6 rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-dark-50">Profile verification</h2>
            <p className="mt-1 text-sm text-dark-400">
              {user?.is_verified
                ? 'Your profile is verified. Members can see your verified badge.'
                : 'Get verified to build trust with other members.'}
            </p>
          </div>
          {user?.is_verified ? (
            <Badge variant="verified" size="md">
              <Shield className="h-4 w-4" aria-hidden="true" />
              Verified
            </Badge>
          ) : (
            <Link
              to="/app/verify"
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-400"
            >
              Verify now
            </Link>
          )}
        </div>
      </section>

      <section className="glass mt-6 rounded-2xl p-5">
        <h2 className="font-display text-lg font-semibold text-dark-50">Your activity</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-dark-700 bg-dark-900/60 p-4">
            <p className="text-sm text-dark-400">Matches</p>
            <p className="mt-1 font-display text-3xl font-bold text-primary-400">
              {matchesStatus === 'success' ? matchCount : '—'}
            </p>
            <Link to="/app/matches" className="mt-2 inline-block text-sm text-primary-400 underline underline-offset-2">
              See your matches
            </Link>
          </div>
          <div className="rounded-xl border border-dark-700 bg-dark-900/60 p-4">
            <p className="text-sm text-dark-400">WhatsApp sharing</p>
            <p className="mt-1 font-display text-xl font-bold text-primary-400">
              {user?.whatsapp_consent ? 'On' : 'Off'}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-dark-500">
              {user?.whatsapp_consent
                ? 'Matched people may request your number. You approve each request before it is released.'
                : 'Matched people cannot request your number.'}
            </p>
          </div>
        </div>

        <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-dark-500">
          <Heart className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Likes you sent and likes you received live in the Likes tab. Nothing here is ever shown to other members.
        </p>
      </section>
    </PageContainer>
  )
}
