import { useCallback, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  BadgeCheck,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Heart,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Star,
  X,
} from 'lucide-react'
import { Avatar, Button, Chip, PageContainer, QueryState, useToast } from '../../components/ui'
import { CardActions } from '../../components/discover/CardActions'
import { MatchModal } from '../../components/discover/MatchModal'
import { WhatsAppButton } from '../../components/contact/WhatsAppButton'
import { useDeck, type DeckKind } from '../../hooks/useDeck'
import { useProfile } from '../../hooks/useProfile'
import { useAuth } from '../../lib/authContext'
import { bucketLabel, LOOKING_FOR_LABELS } from '../../utils/search'
import { formatLastActive, lifestyleLabel, toSearchProfileFromDetail } from '../../utils/profileDetail'
import type { ProfileDetail, SearchProfile } from '../../types'

/**
 * /profile/:id — one member's full public profile.
 *
 * Reads through `get_profile`, which returns no rows for hidden, paused,
 * banned, blocked, self or missing targets. That single indistinguishable
 * "not available" state is rendered here; the page never guesses why a
 * profile is gone.
 */
export function ProfilePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: profile, status, error, reload } = useProfile(id)
  const { act, block, report } = useDeck()
  const toast = useToast()

  const scrollerRef = useRef<HTMLDivElement>(null)
  const [photoIndex, setPhotoIndex] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [busyAction, setBusyAction] = useState<DeckKind | null>(null)
  const [matchOpen, setMatchOpen] = useState(false)
  // The match id created by the just-sent like. `profile.match_id` is stale
  // until get_profile refetches, so the modal must navigate with this value,
  // which came back from send_like itself.
  const [matchId, setMatchId] = useState<string | null>(null)

  const photoCount = profile?.photos.length ?? 0

  const scrollToPhoto = useCallback(
    (index: number) => {
      const scroller = scrollerRef.current
      if (!scroller) return
      const clamped = Math.max(0, Math.min(index, photoCount - 1))
      scroller.scrollTo({ left: clamped * scroller.clientWidth, behavior: 'smooth' })
    },
    [photoCount]
  )

  const onScrollerScroll = useCallback(() => {
    const scroller = scrollerRef.current
    if (!scroller || scroller.clientWidth === 0) return
    setPhotoIndex(Math.round(scroller.scrollLeft / scroller.clientWidth))
  }, [])

  const runAction = useCallback(
    async (kind: DeckKind) => {
      if (!profile || busyAction) return
      setBusyAction(kind)
      const outcome = await act(profile.id, kind)
      setBusyAction(null)

      if (!outcome.ok) {
        toast.addToast({ title: 'That could not be sent', description: outcome.error ?? undefined, type: 'error' })
        return
      }

      if (kind === 'pass') {
        toast.addToast({ title: 'Passed', description: `You passed on ${profile.full_name}.`, type: 'info' })
        return
      }

      if (outcome.matched) {
        setMatchOpen(true)
        setMatchId(outcome.matchId)
        toast.addToast({ title: "It's a match!", description: `${profile.full_name} liked you back.`, type: 'success' })
        return
      }

      toast.addToast({
        title: kind === 'super' ? 'Super Liked' : 'Liked',
        description: `You ${kind === 'super' ? 'super liked' : 'liked'} ${profile.full_name}.`,
        type: 'success',
      })
    },
    [profile, busyAction, act, toast]
  )

  const confirmReport = useCallback(
    async (reason: Parameters<typeof report>[1], details: string) => {
      if (!profile) return
      const outcome = await report(profile.id, reason, details)
      if (!outcome.ok) throw new Error(outcome.error ?? 'The report could not be sent.')
      toast.addToast({ title: 'Report sent', description: 'Our team will review it privately.', type: 'success' })
      navigate('/app/discover')
    },
    [profile, report, toast, navigate]
  )

  const confirmBlock = useCallback(async () => {
    if (!profile) return
    const outcome = await block(profile.id)
    if (!outcome.ok) throw new Error(outcome.error ?? 'The member could not be blocked.')
    toast.addToast({ title: 'Member blocked', description: 'You will not see each other anymore.', type: 'success' })
    navigate('/app/discover')
  }, [profile, block, toast, navigate])

  // The signed-in member never has a profile page of their own.
  if (user && id === user.id) {
    return <Navigate to="/app/me" replace />
  }

  const notFound = (
    <div className="glass-strong rounded-2xl p-10 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-dark-800">
        <X className="h-7 w-7 text-dark-400" aria-hidden="true" />
      </div>
      <h2 className="mt-4 font-display text-xl font-semibold text-dark-50">
        This profile isn&rsquo;t available
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-dark-400">
        It may have been removed, hidden, or you may not be able to see it. Check your discover deck
        for the members you can reach.
      </p>
      <Button className="mt-6" onClick={() => navigate('/app/discover')}>
        Back to Discover
      </Button>
    </div>
  )

  return (
    <PageContainer variant="narrow">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-2 rounded-lg text-sm text-dark-400 transition-colors hover:text-dark-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back
      </button>

      <QueryState
        status={status}
        error={error}
        onRetry={reload}
        label="this profile"
        isEmpty={status === 'success' && !profile}
        empty={notFound}
      >
        {profile && <ProfileDetailView
          profile={profile}
          photoIndex={photoIndex}
          photoCount={photoCount}
          scrollerRef={scrollerRef}
          onScrollerScroll={onScrollerScroll}
          onScrollToPhoto={scrollToPhoto}
          busyAction={busyAction}
          onOpenMenu={() => setMenuOpen(true)}
          onRun={runAction}
        />}
      </QueryState>

      <CardActions
        profile={profile ? toSearchProfileFromDetail(profile) : ({} as SearchProfile)}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onReport={confirmReport}
        onBlock={confirmBlock}
      />
      {profile && (
        <MatchModal
          open={matchOpen}
          profile={toSearchProfileFromDetail(profile)}
          onSendMessage={() => {
            setMatchOpen(false)
            const targetId = matchId ?? profile.match_id
            if (targetId) navigate(`/app/messages/${targetId}`)
          }}
          onKeepSwiping={() => {
            setMatchOpen(false)
            setMatchId(null)
          }}
        />
      )}
    </PageContainer>
  )
}

interface DetailViewProps {
  profile: ProfileDetail
  photoIndex: number
  photoCount: number
  scrollerRef: RefObject<HTMLDivElement | null>
  onScrollerScroll: () => void
  onScrollToPhoto: (index: number) => void
  busyAction: DeckKind | null
  onOpenMenu: () => void
  onRun: (kind: DeckKind) => void
}

function ProfileDetailView({
  profile,
  photoIndex,
  photoCount,
  scrollerRef,
  onScrollerScroll,
  onScrollToPhoto,
  busyAction,
  onOpenMenu,
  onRun,
}: DetailViewProps) {
  const likedBack = profile.viewer_liked_type !== null
  const distance = bucketLabel(profile.distance_bucket)

  const lifestyle = (['smoking', 'drinking', 'exercise'] as const)
    .map((kind) => lifestyleLabel(kind, profile[kind]))
    .filter((value): value is string => value !== null)

  return (
    <article>
      {/* Photo carousel — swipeable on touch (native scroll snap), buttons on every screen. */}
      <div className="relative overflow-hidden rounded-2xl border border-dark-800">
        {photoCount > 0 ? (
          <div
            ref={scrollerRef}
            onScroll={onScrollerScroll}
            className="flex snap-x snap-mandatory overflow-x-auto scrollbar-hide aspect-[3/4]"
            role="region"
            aria-label={`Photos of ${profile.full_name}`}
          >
            {profile.photos.map((src, index) => (
              <div key={src + index} className="w-full shrink-0 snap-center bg-dark-900">
                <img
                  src={src}
                  alt={`Photo ${index + 1} of ${profile.full_name}`}
                  className="h-full w-full object-cover"
                  draggable={false}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex aspect-[3/4] w-full items-center justify-center bg-dark-900">
            <Avatar fallback={profile.full_name} size="xl" />
          </div>
        )}

        {photoCount > 1 && (
          <>
            <button
              type="button"
              onClick={() => onScrollToPhoto(photoIndex - 1)}
              disabled={photoIndex === 0}
              aria-label="Previous photo"
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-dark-950/70 p-2 text-white backdrop-blur transition-colors hover:bg-dark-950/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-40"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onScrollToPhoto(photoIndex + 1)}
              disabled={photoIndex >= photoCount - 1}
              aria-label="Next photo"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-dark-950/70 p-2 text-white backdrop-blur transition-colors hover:bg-dark-950/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-40"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
            <div
              className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5"
              role="tablist"
              aria-label="Photo navigation"
            >
              {profile.photos.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => onScrollToPhoto(index)}
                  aria-label={`Go to photo ${index + 1}`}
                  aria-current={index === photoIndex}
                  className={`h-2 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                    index === photoIndex ? 'w-6 bg-primary-400' : 'w-2 bg-dark-100/60 hover:bg-dark-100'
                  }`}
                />
              ))}
            </div>
          </>
        )}

        {profile.is_online && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-dark-950/80 px-2.5 py-1 text-xs font-medium text-dark-100 backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />
            Online now
          </span>
        )}
      </div>

      <header className="mt-5">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-2xl font-bold text-dark-50">
            {profile.full_name}, {profile.age}
          </h1>
          {profile.is_verified && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-primary-600/15 px-2 py-0.5 text-xs font-semibold text-primary-300"
              aria-label="Verified profile"
            >
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Verified
            </span>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-dark-400">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-4 w-4" aria-hidden="true" />
            {profile.location_city}
            {profile.location_country ? `, ${profile.location_country}` : ''}
          </span>
          <span aria-hidden="true">&middot;</span>
          <span>{distance}</span>
        </div>
        <p className="mt-1 text-sm text-dark-500">
          {profile.is_online ? 'Online now' : formatLastActive(profile.last_active)}
        </p>
        {profile.liked_viewer && !profile.is_match && (
          <p className="mt-1 text-sm font-medium text-primary-300">
            {profile.full_name.split(' ')[0]} liked you — like them back to match.
          </p>
        )}
      </header>

      {/* The profile's own words and choices. */}
      <div className="mt-6 space-y-6">
        <section>
          <h2 className="font-display text-lg font-semibold text-dark-100">About</h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-dark-300">
            {profile.bio.trim() ? profile.bio : 'This member has not written a bio yet.'}
          </p>
        </section>

        {profile.looking_for && (
          <section>
            <h2 className="font-display text-lg font-semibold text-dark-100">Looking for</h2>
            <p className="mt-2 text-sm text-dark-300">{LOOKING_FOR_LABELS[profile.looking_for]}</p>
          </section>
        )}

        {profile.interests.length > 0 && (
          <section>
            <h2 className="font-display text-lg font-semibold text-dark-100">Interests</h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {profile.interests.map((interest) => (
                <li key={interest}>
                  <Chip>{interest}</Chip>
                </li>
              ))}
            </ul>
          </section>
        )}

        {lifestyle.length > 0 && (
          <section>
            <h2 className="font-display text-lg font-semibold text-dark-100">Lifestyle</h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {lifestyle.map((item) => (
                <li key={item}>
                  <Chip>{item}</Chip>
                </li>
              ))}
            </ul>
          </section>
        )}

        {profile.languages.length > 0 && (
          <section>
            <h2 className="font-display text-lg font-semibold text-dark-100">Languages</h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {profile.languages.map((language) => (
                <li key={language}>
                  <Chip>{language}</Chip>
                </li>
              ))}
            </ul>
          </section>
        )}

        {(profile.occupation || profile.education) && (
          <section>
            <h2 className="font-display text-lg font-semibold text-dark-100">Work &amp; education</h2>
            <ul className="mt-2 space-y-1 text-sm text-dark-300">
              {profile.occupation && (
                <li className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-dark-500" aria-hidden="true" />
                  {profile.occupation}
                </li>
              )}
              {profile.education && (
                <li className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-dark-500" aria-hidden="true" />
                  {profile.education}
                </li>
              )}
            </ul>
          </section>
        )}
      </div>

      {/* Sticky action bar. */}
      <div className="sticky bottom-3 z-40 mt-8">
        <div className="glass-strong rounded-2xl border border-dark-800 px-3 py-2.5 shadow-glow">
          <div className="flex items-center justify-center gap-3">
            {!profile.is_match && (
              <>
                <ActionButton
                  label={`Pass on ${profile.full_name}`}
                  onClick={() => onRun('pass')}
                  busy={busyAction === 'pass'}
                  tone="pass"
                >
                  <X className="h-6 w-6" aria-hidden="true" />
                </ActionButton>
                <ActionButton
                  label={likedBack ? `You liked ${profile.full_name}` : `Like ${profile.full_name}`}
                  onClick={() => onRun('like')}
                  disabled={likedBack}
                  busy={busyAction === 'like'}
                  tone="like"
                >
                  {likedBack ? <Heart className="h-6 w-6 fill-current" aria-hidden="true" /> : <Heart className="h-6 w-6" aria-hidden="true" />}
                </ActionButton>
                <ActionButton
                  label={`Super like ${profile.full_name}`}
                  onClick={() => onRun('super')}
                  busy={busyAction === 'super'}
                  tone="super"
                >
                  <Star className="h-6 w-6" aria-hidden="true" />
                </ActionButton>
              </>
            )}

            {profile.is_match && profile.match_id && (
              <Link
                to={`/app/messages/${profile.match_id}`}
                className="inline-flex min-w-0 items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-3 text-sm font-semibold text-white shadow-glow transition-colors hover:bg-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              >
                <MessageCircle className="h-5 w-5" aria-hidden="true" />
                Message {profile.full_name.split(' ')[0]}
              </Link>
            )}

            <button
              type="button"
              onClick={onOpenMenu}
              aria-label="More options for this profile"
              className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-dark-700 bg-dark-900 text-dark-300 transition-colors hover:border-dark-600 hover:text-dark-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          {/* Consent-gated WhatsApp handover. Shown only where contact is
              plausibly on the table: a match, or a target who opted into
              receiving requests. The number never leaves the database until
              the click calls get_contact_link. */}
          {(profile.is_match || profile.contact_can_request) && (
            <div className="mt-2 border-t border-dark-800 px-1 pt-2.5">
              <WhatsAppButton
                targetUserId={profile.id}
                name={profile.full_name}
                canRequest={profile.contact_can_request}
              />
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

interface ActionButtonProps {
  label: string
  onClick: () => void
  busy?: boolean
  disabled?: boolean
  tone: 'pass' | 'like' | 'super'
  children: ReactNode
}

function ActionButton({ label, onClick, busy, disabled, tone, children }: ActionButtonProps) {
  const tones = {
    pass: 'border-red-500/40 text-red-400 hover:bg-red-500/10',
    like: 'border-primary-500/50 text-primary-400 hover:bg-primary-600/10',
    super: 'border-amber-400/40 text-amber-400 hover:bg-amber-400/10',
  } as const

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      aria-label={label}
      aria-busy={busy}
      className={`inline-flex h-12 w-12 items-center justify-center rounded-full border bg-dark-900 shadow-glow transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:scale-100 ${tones[tone]}`}
    >
      {children}
    </button>
  )
}