import { LOOKING_FOR_OPTIONS } from '../../../data/onboardingOptions'
import type { StepProps } from './types'

/**
 * Step 5 — what you are here for. One choice from the fixed `looking_for`
 * vocabulary, presented as selectable cards. Selecting writes immediately, so
 * this step is complete the moment a card is picked.
 */
export function LookingForStep({ draft, errors, update, savedAt, saving }: StepProps) {
  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="text-sm font-medium text-dark-300">
          What are you looking for? <span className="text-primary-500" aria-hidden="true">*</span>
        </legend>
        <div className="mt-3 grid gap-3">
          {LOOKING_FOR_OPTIONS.map((option) => {
            const picked = draft.lookingFor === option.value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => update({ lookingFor: option.value as typeof draft.lookingFor }, 'immediate')}
                aria-pressed={picked}
                className={
                  picked
                    ? 'rounded-2xl border border-primary-500 bg-primary-600/15 p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-400'
                    : 'rounded-2xl border border-dark-700 bg-dark-900/60 p-4 text-left transition hover:border-primary-500/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-400'
                }
              >
                <span className="flex items-center justify-between">
                  <span className="font-medium text-dark-100">{option.label}</span>
                  <span
                    aria-hidden="true"
                    className={
                      picked
                        ? 'flex h-5 w-5 items-center justify-center rounded-full border-2 border-primary-500 bg-primary-500'
                        : 'flex h-5 w-5 items-center justify-center rounded-full border-2 border-dark-600'
                    }
                  >
                    {picked && (
                      <svg viewBox="0 0 12 12" className="h-3 w-3 text-white" fill="none">
                        <path d="M2.5 6.5 5 9l4.5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                </span>
                <span className="mt-1 block text-sm leading-relaxed text-dark-400">
                  {option.description}
                </span>
              </button>
            )
          })}
        </div>
        {errors.lookingFor && (
          <p className="mt-1.5 text-sm text-red-400" role="alert">
            {errors.lookingFor}
          </p>
        )}
      </fieldset>

      <SaveStatus saving={saving} savedAt={savedAt} />
    </div>
  )
}

function SaveStatus({ saving, savedAt }: { saving: boolean; savedAt: number | null }) {
  if (saving) return <p className="text-xs text-dark-500" aria-live="polite">Saving…</p>
  if (savedAt !== null) return <p className="text-xs text-emerald-400" aria-live="polite">Saved</p>
  return <p className="text-xs text-dark-600" aria-live="polite">Your changes save as you go.</p>
}