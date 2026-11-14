import { DRINKING_OPTIONS, EXERCISE_OPTIONS, INTERESTS, SMOKING_OPTIONS } from '../../../data/onboardingOptions'
import { Select } from '../../../components/ui'
import type { StepProps } from './types'

const MIN_INTERESTS = 5
const MAX_INTERESTS = 10

/**
 * Step 4 — interests and lifestyle. Interests are chips with a 5–10 band (the
 * DB permits up to 20; the product deliberately asks for a tighter range).
 * Lifestyle answers live inside the fixed vocabulary the CHECK constraints
 * allow, so a select can never produce an invalid value.
 */
export function InterestsStep({ draft, errors, update, savedAt, saving }: StepProps) {
  const toggle = (interest: string) => {
    const picked = draft.interests.includes(interest)
    const next = picked
      ? draft.interests.filter((value) => value !== interest)
      : [...draft.interests, interest].slice(0, MAX_INTERESTS)
    update({ interests: next }, 'immediate')
  }

  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="text-sm font-medium text-dark-300">
          Pick {MIN_INTERESTS}–{MAX_INTERESTS} interests
        </legend>
        <p className="mt-1 text-xs text-dark-500" aria-live="polite">
          {draft.interests.length} chosen — {draft.interests.length >= MIN_INTERESTS ? 'ready to continue' : `${MIN_INTERESTS - draft.interests.length} more to go`}
        </p>
        {errors.interests && (
          <p className="mt-1.5 text-sm text-red-400" role="alert">
            {errors.interests}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Interests">
          {INTERESTS.map((interest) => {
            const picked = draft.interests.includes(interest)
            const atCap = !picked && draft.interests.length >= MAX_INTERESTS
            return (
              <button
                key={interest}
                type="button"
                onClick={() => toggle(interest)}
                disabled={atCap}
                aria-pressed={picked}
                className={
                  picked
                    ? 'rounded-full border border-primary-500 bg-primary-600/30 px-3 py-1.5 text-sm font-medium text-primary-200 transition disabled:opacity-40'
                    : 'rounded-full border border-dark-600 bg-dark-900/60 px-3 py-1.5 text-sm text-dark-300 transition hover:border-primary-500/50 hover:text-primary-300 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-400'
                }
              >
                {interest}
                {picked && <span className="sr-only"> (selected)</span>}
              </button>
            )
          })}
        </div>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-3">
        <Select
          label="Smoking"
          id="interests-smoking"
          value={draft.smoking}
          options={SMOKING_OPTIONS}
          onChange={(event) => update({ smoking: event.target.value as typeof draft.smoking }, 'immediate')}
        />
        <Select
          label="Drinking"
          id="interests-drinking"
          value={draft.drinking}
          options={DRINKING_OPTIONS}
          onChange={(event) => update({ drinking: event.target.value as typeof draft.drinking }, 'immediate')}
        />
        <Select
          label="Exercise"
          id="interests-exercise"
          value={draft.exercise}
          options={EXERCISE_OPTIONS}
          onChange={(event) => update({ exercise: event.target.value as typeof draft.exercise }, 'immediate')}
        />
      </div>

      <SaveStatus saving={saving} savedAt={savedAt} />
    </div>
  )
}

function SaveStatus({ saving, savedAt }: { saving: boolean; savedAt: number | null }) {
  if (saving) return <p className="text-xs text-dark-500" aria-live="polite">Saving…</p>
  if (savedAt !== null) return <p className="text-xs text-emerald-400" aria-live="polite">Saved</p>
  return <p className="text-xs text-dark-600" aria-live="polite">Your changes save as you go.</p>
}