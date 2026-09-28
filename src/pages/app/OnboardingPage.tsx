import { Link } from 'react-router-dom'
import { Compass, Heart, MapPin, Shield, SlidersHorizontal, User } from 'lucide-react'
import { PageContainer, PageSpinner } from '../../components/ui'
import { useAuth } from '../../lib/authContext'

interface SetupTask {
  id: 'name' | 'bio' | 'location' | 'photos' | 'interestedIn'
  title: string
  detail: string
  to: string
  cta: string
  icon: typeof User
}

/**
 * Onboarding is the signed-in checklist that points at the screens which do the
 * actual work. It deliberately does not pretend to be a multi-step wizard: this
 * build has no wizard state to persist, so a progress bar counting eight steps
 * would be a fiction. Every control here navigates somewhere real.
 */
export function OnboardingPage() {
  const { user, loading } = useAuth()

  if (loading || !user) {
    return (
      <PageContainer variant="narrow">
        <div className="flex flex-col items-center gap-4 py-20" role="status">
          <PageSpinner size="lg" variant="primary" />
          <p className="text-sm text-dark-400">Loading your account…</p>
        </div>
      </PageContainer>
    )
  }

  const done: Record<SetupTask['id'], boolean> = {
    name: Boolean(user.full_name?.trim()),
    bio: Boolean(user.bio?.trim()),
    location: Boolean(user.location_city?.trim() && user.location_country?.trim()),
    photos: (user.photos?.length ?? 0) > 0,
    interestedIn: (user.interested_in?.length ?? 0) > 0,
  }

  const tasks: SetupTask[] = [
    {
      id: 'name',
      title: 'Your name',
      detail: 'The name other people see. Between 2 and 50 characters.',
      to: '/app/me/edit',
      cta: 'Set your name',
      icon: User,
    },
    {
      id: 'bio',
      title: 'A short bio',
      detail: 'What you are actually looking for, in your own words. Up to 500 characters.',
      to: '/app/me/edit',
      cta: 'Write your bio',
      icon: Heart,
    },
    {
      id: 'location',
      title: 'Your city and country',
      detail: 'Only the city and country are published. Your coordinates are stored rounded to two decimal places and never shown to anyone.',
      to: '/app/me/edit',
      cta: 'Set your location',
      icon: MapPin,
    },
    {
      id: 'photos',
      title: 'At least one photo',
      detail:
        'Photo upload is not built in this release. Until it is, add a photo URL on the edit screen and it will render everywhere your profile does.',
      to: '/app/me/edit',
      cta: 'Review your profile',
      icon: Compass,
    },
    {
      id: 'interestedIn',
      title: 'Who you are interested in',
      detail: 'Drives who appears in Discover and Search.',
      to: '/app/me/edit',
      cta: 'Choose preferences',
      icon: SlidersHorizontal,
    },
  ]

  const complete = tasks.filter((task) => done[task.id]).length
  const percent = Math.round((complete / tasks.length) * 100)
  const finished = complete === tasks.length

  return (
    <PageContainer variant="narrow">
      <header className="mb-8">
        <p className="text-xs font-medium uppercase tracking-widest text-primary-400">
          Get started
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-dark-50">
          {finished ? 'Your profile is complete' : 'Finish setting up your profile'}
        </h1>
        <p className="mt-2 leading-relaxed text-dark-400">
          {complete} of {tasks.length} done. Everything below is edited on one screen, so you can
          work through it in any order.
        </p>

        <div
          className="mt-5 h-2 overflow-hidden rounded-full bg-dark-800"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Profile setup progress"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-600 transition-[width] duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
      </header>

      <ol className="space-y-3">
        {tasks.map((task) => {
          const isDone = done[task.id]
          const Icon = task.icon

          return (
            <li key={task.id}>
              <div
                className={
                  isDone
                    ? 'flex flex-col gap-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 sm:flex-row sm:items-center'
                    : 'flex flex-col gap-4 rounded-2xl border border-dark-700 bg-dark-900/60 p-5 sm:flex-row sm:items-center'
                }
              >
                <span
                  className={
                    isDone
                      ? 'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400'
                      : 'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-600/15 text-primary-400'
                  }
                  aria-hidden="true"
                >
                  <Icon className="h-5 w-5" />
                </span>

                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold text-dark-50">
                    {task.title}
                    <span className="sr-only">{isDone ? ' — done' : ' — not done yet'}</span>
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-dark-400">{task.detail}</p>
                </div>

                {isDone ? (
                  <span className="shrink-0 text-sm font-medium text-emerald-400">Done</span>
                ) : (
                  <Link
                    to={task.to}
                    className="shrink-0 rounded-xl border border-primary-500/50 px-4 py-2 text-sm font-medium text-primary-400 transition hover:bg-primary-600/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-400"
                  >
                    {task.cta}
                  </Link>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      <p className="mt-6 flex items-start gap-2 rounded-xl border border-dark-700 bg-dark-900/60 p-4 text-xs leading-relaxed text-dark-400">
        <Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary-400" aria-hidden="true" />
        <span>
          Discovery filters — age range, maximum distance band and who can find you — live in
          settings, and are separate from your profile. Distances are always shown as bands, never
          as an exact figure.
        </span>
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          to="/app/discover"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 px-5 py-3 font-medium text-white transition hover:from-primary-500 hover:to-primary-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-400"
        >
          <Compass className="h-4 w-4" aria-hidden="true" />
          Start browsing
        </Link>
        <Link
          to="/app/settings"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-dark-700 bg-dark-800/60 px-5 py-3 font-medium text-dark-100 transition hover:border-primary-500/50 hover:bg-dark-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-400"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          Discovery settings
        </Link>
      </div>
    </PageContainer>
  )
}
