import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Compass, Shield } from 'lucide-react'
import { Button, InlineMessage, PageContainer, PageSpinner } from '../../components/ui'
import { useAuth } from '../../lib/authContext'
import { supabase } from '../../lib/supabase'
import { useMemberPhotos } from '../../hooks/useMemberPhotos'
import { MIN_PROFILE_PHOTOS, isProfileComplete } from '../../utils/profileCompleteness'
import { normalizeToE164 } from '../../utils/phoneUtils'
import type { OnboardingDraft, StepKey } from '../../utils/onboardingSchemas'
import { draftFromProfile, patchToProfile, validateStep } from './onboarding/wizardState'
import type { StepValidation } from './onboarding/wizardState'
import { ProgressBar } from './onboarding/ProgressBar'
import { BasicsStep } from './onboarding/BasicsStep'
import { LocationStep } from './onboarding/LocationStep'
import { AboutStep } from './onboarding/AboutStep'
import { InterestsStep } from './onboarding/InterestsStep'
import { LookingForStep } from './onboarding/LookingForStep'
import { PhotosStep } from './onboarding/PhotosStep'
import { ContactStep } from './onboarding/ContactStep'
import { ReviewStep } from './onboarding/ReviewStep'

const STEP_KEYS: StepKey[] = [
  'basics',
  'location',
  'about',
  'interests',
  'lookingFor',
  'photos',
  'contact',
  'review',
]

const STEP_META: Record<(typeof STEP_KEYS)[number], { title: string; subtitle: string }> = {
  basics: { title: 'The basics', subtitle: 'Your name, age and who you are.' },
  location: { title: 'Your location', subtitle: 'Where people can find you.' },
  about: { title: 'About you', subtitle: 'A short bio and a few essentials.' },
  interests: { title: 'Your interests', subtitle: 'Pick 5–10 things you love.' },
  lookingFor: { title: 'What are you looking for?', subtitle: 'One answer — no pressure.' },
  photos: { title: 'Your photos', subtitle: 'At least two — the first one is your main photo.' },
  contact: { title: 'Your contact preference', subtitle: 'Optional — you stay in control.' },
  review: { title: 'Review before you start', subtitle: 'Everything you told us, in one place.' },
}

/**
 * Onboarding is an eight-step wizard: Basics, Location, About, Interests,
 * Looking for, Photos, Contact, Review. Every change auto-saves — discrete
 * selections immediately, free text about 800ms after the last keystroke — so
 * a member who closes the tab mid-way resumes exactly where their data was.
 *
 * "Done" is the review step: it flashes nothing, it flushes any pending write,
 * refreshes the profile from the server (fresh photo count included) and sends
 * the member to Discovery, where the completeness guard is now satisfied.
 */
export function OnboardingPage() {
  const navigate = useNavigate()
  const { user, loading, updateProfile, refreshProfile } = useAuth()
  const photosApi = useMemberPhotos()

  const [draft, setDraft] = useState<OnboardingDraft | null>(null)
  const [step, setStep] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // The latest draft, readable inside callbacks without a dependency cycle.
  const draftRef = useRef<OnboardingDraft | null>(null)
  /*
   * Snapshot of whether the member was complete when the wizard resumed. The
   * completion screen is for *revisits* only: a member who becomes complete
   * mid-walk (the final photo upload is usually the last required field) must
   * still walk contact and review — their Finish click is what lands them on
   * Discovery. Reading the live profile here would swap the wizard for the
   * completion screen the moment `refreshProfile` reports the 2nd photo.
   */
  const completeOnResumeRef = useRef<boolean | null>(null)
  // Debounced text coalesces here; the timer is per-editor.
  const pendingRef = useRef<Partial<OnboardingDraft>>({})
  const debounceRef = useRef<number | null>(null)
  // Saves are serialised so two writes to the same row never interleave.
  const chainRef = useRef<Promise<void>>(Promise.resolve())

  /*
   * Resume: seed the draft once from the persisted profile (and the owner's
   * `private_contacts` row, which holds the WhatsApp number and share mode).
   * The `draftRef.current === null` guard means the store's refreshProfile,
   * which replaces the `user` object, can never reset the member's typing.
   */
  useEffect(() => {
    if (!user || draftRef.current !== null) return
    let cancelled = false
    void (async () => {
      const base = draftFromProfile(user)
      const { data } = await supabase
        .from('private_contacts')
        .select('whatsapp_number, share_mode')
        .eq('user_id', user.id)
        .maybeSingle()
      if (cancelled || draftRef.current !== null) return
      const seeded: OnboardingDraft = {
        ...base,
        whatsappNumber: data?.whatsapp_number ?? '',
        shareMode: data?.share_mode ?? 'never',
        whatsappConsent: user.whatsapp_consent ?? false,
      }
      draftRef.current = seeded
      setDraft(seeded)
      // Freeze the completion decision at the moment the wizard resumes. The
      // profile only becomes data-complete mid-walk once the photos step adds
      // the second photo; if we re-read the live profile here the wizard would
      // be swapped for the completion screen while the member still has to
      // walk contact and review. Only a genuine revisit by an already-finished
      // member may show the completion state.
      if (completeOnResumeRef.current === null) {
        completeOnResumeRef.current = isProfileComplete(user)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  // `photosApi.load` is memoised per `user`, so it is safe to close over and
  // depend on the function identity rather than the whole hook result object.
  const { load: loadPhotos } = photosApi
  useEffect(() => {
    if (user) void loadPhotos()
  }, [user, loadPhotos])

  // Clear a pending debounce timer when the wizard unmounts, so navigation
  // away mid-typing cannot write into a torn-down component.
  useEffect(
    () => () => {
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current)
    },
    []
  )

  /*
   * The number lives only in private_contacts, so a phone write is an upsert
   * of that row (or a delete when the member turned sharing off or cleared the
   * number). The value is normalised to E.164 — exactly what the is_e164 CHECK
   * demands — before it is written.
   */
  const syncContact = useCallback(
    async (current: OnboardingDraft) => {
      if (!user) return
      const raw = current.whatsappNumber.trim()
      if (!current.whatsappConsent || raw === '') {
        await supabase.from('private_contacts').delete().eq('user_id', user.id)
        return
      }
      const normalized = normalizeToE164(raw)
      if (normalized === null) return // invalid mid-typing; Continue will surface it
      const { error } = await supabase
        .from('private_contacts')
        .upsert(
          {
            user_id: user.id,
            whatsapp_number: normalized,
            share_mode: current.shareMode,
          },
          { onConflict: 'user_id' }
        )
      if (error) throw new Error(error.message)
    },
    [user]
  )

  /*
   * The single write path. Serialised through the chain so updates to the same
   * profile row land in order, and the member's private_contacts row follows
   * the profile write when a contact field changed.
   */
  const enqueueSave = useCallback(
    (patch: Partial<OnboardingDraft>) => {
      const task = chainRef.current.then(async () => {
        setSaving(true)
        setSaveError(null)
        try {
          const profilePatch = patchToProfile(patch)
          if (Object.keys(profilePatch).length > 0) {
            const { error } = await updateProfile(profilePatch)
            if (error) throw new Error(error.message)
          }

          const contactTouched =
            'whatsappNumber' in patch || 'shareMode' in patch || 'whatsappConsent' in patch
          if (contactTouched && user && draftRef.current) {
            await syncContact(draftRef.current)
          }

          setSavedAt(Date.now())
        } catch (error) {
          setSaveError(error instanceof Error ? error.message : 'Could not save your changes')
        } finally {
          setSaving(false)
        }
      })
      chainRef.current = task.catch(() => undefined)
      return task
    },
    [user, updateProfile, syncContact]
  )

  const flushPending = useCallback(() => {
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    const patch = pendingRef.current
    pendingRef.current = {}
    if (Object.keys(patch).length > 0) return enqueueSave(patch)
    return chainRef.current
  }, [enqueueSave])

  /**
   * The single update point every step uses. Draft merge happens synchronously
   * (the UI must never wait on the network); persistence follows the mode —
   * discrete selections write right away, text waits for a quiet moment.
   */
  const update = useCallback(
    (patch: Partial<OnboardingDraft>, mode: 'immediate' | 'debounced' = 'immediate') => {
      const current = draftRef.current
      if (!current) return
      const next = { ...current, ...patch }
      draftRef.current = next
      setDraft(next)

      if (mode === 'immediate') {
        flushPending()
        void enqueueSave(patch)
      } else {
        pendingRef.current = { ...pendingRef.current, ...patch }
        if (debounceRef.current !== null) window.clearTimeout(debounceRef.current)
        debounceRef.current = window.setTimeout(() => {
          debounceRef.current = null
          void flushPending()
        }, 800)
      }
    },
    [enqueueSave, flushPending]
  )

  const pastedPhotoCount = user?.photos?.length ?? 0
  const photoTotal = photosApi.photos.length + pastedPhotoCount

  const goBack = () => {
    setErrors({})
    setStep((current) => Math.max(0, current - 1))
  }

  const goNext = () => {
    if (!draft) return

    if (step === 5) {
      // Photos are validated live: the wizard needs at least two total.
      if (photoTotal < MIN_PROFILE_PHOTOS) {
        setErrors({ photos: `Add at least ${MIN_PROFILE_PHOTOS} photos to continue` })
        return
      }
      setErrors({})
      flushPending()
      setStep(6)
      return
    }

    if (step === 7) {
      void handleFinish()
      return
    }

    const key = STEP_KEYS[step] as StepValidation
    const result = validateStep(key, draft)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors({})
    flushPending()
    setStep((current) => Math.min(current + 1, STEP_KEYS.length - 1))
  }

  const handleFinish = async () => {
    setSubmitting(true)
    try {
      await flushPending()
      await refreshProfile()
      navigate('/app/discover', { replace: true })
    } finally {
      setSubmitting(false)
    }
  }

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

  // A member who finished every step and revisits sees the completion state,
  // not the wizard. The h1 contract is the reverse: while anything is missing
  // (which is where the auth-flow e2e lands fresh members), it must read
  // "Finish setting up your profile". The decision is the mount-time snapshot
  // (`completeOnResumeRef`), never the live profile — the profile only
  // becomes complete mid-walk once the second photo uploads, and re-reading
  // it there would eject the wizard before contact and review.
  if (draft === null) {
    return (
      <PageContainer variant="narrow">
        <div className="flex flex-col items-center gap-4 py-20" role="status">
          <PageSpinner size="lg" variant="primary" />
          <p className="text-sm text-dark-400">Loading your profile…</p>
        </div>
      </PageContainer>
    )
  }

  if (completeOnResumeRef.current === true) {
    return (
      <PageContainer variant="narrow">
        <header className="mb-8">
          <h1 className="font-display text-3xl font-bold text-dark-50">Your profile is complete</h1>
          <p className="mt-2 leading-relaxed text-dark-400">
            Everything is set. Discovery is waiting for you.
          </p>
        </header>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button variant="primary" size="lg" onClick={() => navigate('/app/discover')}>
            <Compass className="h-4 w-4" aria-hidden="true" />
            Start browsing
          </Button>
        </div>
      </PageContainer>
    )
  }

  const meta = STEP_META[STEP_KEYS[step]]
  const isReview = step === STEP_KEYS.length - 1

  return (
    <PageContainer variant="narrow">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold text-dark-50">
          Finish setting up your profile
        </h1>
        <p className="mt-2 leading-relaxed text-dark-400">
          A couple of minutes now, and you are on your way.
        </p>
      </header>

      <ProgressBar current={step} total={STEP_KEYS.length} />

      <section aria-labelledby="step-title">
        <h2 id="step-title" className="font-semibold text-xl text-dark-50">
          {meta.title}
        </h2>
        <p className="mt-1 text-sm text-dark-400">{meta.subtitle}</p>

        <div className="mt-6">
          {saveError && (
            <div className="mb-6" role="alert">
              <InlineMessage tone="error">{saveError}</InlineMessage>
            </div>
          )}

          {step === 0 && (
            <BasicsStep
              draft={draft}
              errors={errors}
              update={update}
              savedAt={savedAt}
              saving={saving}
            />
          )}
          {step === 1 && (
            <LocationStep
              draft={draft}
              errors={errors}
              update={update}
              savedAt={savedAt}
              saving={saving}
            />
          )}
          {step === 2 && (
            <AboutStep draft={draft} errors={errors} update={update} savedAt={savedAt} saving={saving} />
          )}
          {step === 3 && (
            <InterestsStep
              draft={draft}
              errors={errors}
              update={update}
              savedAt={savedAt}
              saving={saving}
            />
          )}
          {step === 4 && (
            <LookingForStep
              draft={draft}
              errors={errors}
              update={update}
              savedAt={savedAt}
              saving={saving}
            />
          )}
          {step === 5 && (
            <PhotosStep
              draft={draft}
              errors={errors}
              update={update}
              savedAt={savedAt}
              saving={saving}
              photos={photosApi.photos}
              photosLoading={photosApi.loading}
              photosError={photosApi.error}
              pastedPhotoCount={pastedPhotoCount}
              uploadProgress={photosApi.progress}
              uploading={photosApi.progress !== null}
              onUpload={photosApi.upload}
              onDelete={photosApi.remove}
              onReorder={photosApi.reorder}
            />
          )}
          {step === 6 && (
            <ContactStep
              draft={draft}
              errors={errors}
              update={update}
              savedAt={savedAt}
              saving={saving}
            />
          )}
          {step === 7 && (
            <ReviewStep
              draft={draft}
              errors={errors}
              update={update}
              savedAt={savedAt}
              saving={saving}
              photoCount={photoTotal}
              photoReady={photoTotal >= MIN_PROFILE_PHOTOS}
              onEditStep={setStep}
            />
          )}
        </div>
      </section>

      <nav className="mt-8 flex items-center justify-between gap-4" aria-label="Wizard navigation">
        {step > 0 ? (
          <Button variant="ghost" onClick={goBack}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back
          </Button>
        ) : (
          <span />
        )}
        <Button variant="primary" size="lg" onClick={goNext} loading={submitting}>
          {isReview ? 'Finish' : 'Continue'}
        </Button>
      </nav>

      <p className="mt-6 flex items-start gap-2 rounded-xl border border-dark-700 bg-dark-900/60 p-4 text-xs leading-relaxed text-dark-400">
        <Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary-400" aria-hidden="true" />
        <span>
          Everything saves as you go, and nothing is shared until you finish. Discovery filters
          live in settings and distances are always shown as bands, never an exact figure.
        </span>
      </p>
    </PageContainer>
  )
}