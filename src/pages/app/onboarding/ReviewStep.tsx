import { CheckSquare, ChevronLeft, HeartHandshake, ImagePlus, MapPin, Phone, User } from 'lucide-react'
import { labelFor, LOOKING_FOR_OPTIONS, DRINKING_OPTIONS, SMOKING_OPTIONS, EXERCISE_OPTIONS } from '../../../data/onboardingOptions'
import { MIN_PROFILE_PHOTOS } from '../../../utils/profileCompleteness'
import type { StepProps } from './types'

interface ReviewStepProps extends StepProps {
  photoCount: number
  photoReady: boolean
  onEditStep: (index: number) => void
}

const GENDER_LABELS: Record<string, string> = {
  male: 'Man',
  female: 'Woman',
  non_binary: 'Non-binary',
  prefer_not_to_say: 'Prefer not to say',
}

const INTERESTED_LABELS: Record<string, string> = {
  male: 'Men',
  female: 'Women',
  non_binary: 'Non-binary people',
  everyone: 'Everyone',
}

/**
 * Step 8 — the review. Not a form: it summarises every answer, flags anything
 * still missing, and hands the member back to a step with one tap. Nothing is
 * written here — the draft has been auto-saving all along.
 */
export function ReviewStep({ draft, photoCount, photoReady, onEditStep, savedAt, saving }: ReviewStepProps) {
  const rows = [
    {
      icon: User,
      label: 'Basics',
      value: [
        draft.fullName,
        GENDER_LABELS[draft.gender],
        `Age ${ageFromDate(draft.dateOfBirth)}`,
        draft.interestedIn.length > 0
          ? `Interested in ${draft.interestedIn.map((value) => INTERESTED_LABELS[value]).join(', ')}`
          : '',
      ]
        .filter(Boolean)
        .join(' · '),
      missing: !draft.fullName.trim() || !draft.dateOfBirth,
      step: 0,
    },
    {
      icon: MapPin,
      label: 'Location',
      value: [draft.locationCity, draft.locationCountry].filter(Boolean).join(', '),
      missing: !draft.locationCity.trim() || !draft.locationCountry.trim(),
      step: 1,
    },
    {
      icon: CheckSquare,
      label: 'About me',
      value: draft.bio.trim(),
      missing: !draft.bio.trim(),
      step: 2,
    },
    {
      icon: HeartHandshake,
      label: 'Interests',
      value: draft.interests.length > 0 ? `${draft.interests.length} selected · ${draft.interests.slice(0, 3).join(', ')}${draft.interests.length > 3 ? '…' : ''}` : 'None yet',
      missing: draft.interests.length < 5,
      step: 3,
    },
    {
      icon: HeartHandshake,
      label: 'Looking for',
      value: labelFor(draft.lookingFor, LOOKING_FOR_OPTIONS as unknown as { value: string; label: string }[]),
      missing: false,
      step: 4,
    },
    {
      icon: ImagePlus,
      label: 'Photos',
      value: photoReady
        ? `${photoCount} total — first one is your main photo`
        : `Add at least ${MIN_PROFILE_PHOTOS} photos to continue`,
      missing: !photoReady,
      step: 5,
    },
    {
      icon: Phone,
      label: 'Contact',
      value: draft.whatsappConsent
        ? `WhatsApp shared with ${labelFor(draft.shareMode, [
            { value: 'matches', label: 'matches' },
            { value: 'approved', label: 'approved-only' },
            { value: 'never', label: 'no one' },
          ])}`
        : 'Not sharing a number',
      missing: false,
      step: 6,
    },
  ]

  const lifestyle = [
    labelFor(draft.smoking, SMOKING_OPTIONS as unknown as { value: string; label: string }[]),
    labelFor(draft.drinking, DRINKING_OPTIONS as unknown as { value: string; label: string }[]),
    labelFor(draft.exercise, EXERCISE_OPTIONS as unknown as { value: string; label: string }[]),
  ].filter(Boolean)

  return (
    <div className="space-y-5">
      <ol className="space-y-2" aria-label="Review your answers">
        {rows.map((row) => (
          <li key={row.label}>
            <div className="flex items-center gap-3 rounded-xl border border-dark-700 bg-dark-900/60 p-4">
              <span className="text-primary-400"><row.icon className="h-4 w-4" aria-hidden="true" /></span>
              <span className="w-28 shrink-0 text-sm font-medium text-dark-300">{row.label}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-dark-100">{row.value}</span>
              <div className="flex shrink-0 items-center gap-2">
                {row.missing && (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-400">
                    Missing
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onEditStep(row.step)}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-primary-400 transition hover:bg-primary-600/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-400"
                  aria-label={`Edit ${row.label}`}
                >
                  <ChevronLeft className="h-3 w-3" aria-hidden="true" />
                  Edit
                </button>
              </div>
            </div>
          </li>
        ))}
      </ol>

      <div className="rounded-xl border border-dark-700 bg-dark-900/60 p-4">
        <p className="text-sm font-medium text-dark-200">Lifestyle</p>
        <p className="mt-1 text-sm text-dark-400">
          {lifestyle.length > 0 ? lifestyle.join(' · ') : 'Smoking, drinking and exercise preferences'}
        </p>
      </div>

      <SaveStatus saving={saving} savedAt={savedAt} />
    </div>
  )
}

function ageFromDate(date: string): string {
  if (!date) return '—'
  const birth = new Date(date)
  if (Number.isNaN(birth.getTime())) return '—'
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const beforeBirthday = now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())
  if (beforeBirthday) age -= 1
  return Number.isFinite(age) ? String(age) : '—'
}

function SaveStatus({ saving, savedAt }: { saving: boolean; savedAt: number | null }) {
  if (saving) return <p className="text-xs text-dark-500" aria-live="polite">Saving…</p>
  if (savedAt !== null) return <p className="text-xs text-emerald-400" aria-live="polite">Saved</p>
  return <p className="text-xs text-dark-600" aria-live="polite">Your changes save as you go.</p>
}