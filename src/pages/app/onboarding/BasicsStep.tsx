import { latestDateOfBirth } from '../../../utils/validation'
import { Input, Select } from '../../../components/ui'
import type { StepProps } from './types'

const GENDER_OPTIONS = [
  { value: 'male', label: 'Man' },
  { value: 'female', label: 'Woman' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
]

const INTERESTED_IN_OPTIONS = [
  { value: 'male', label: 'Men' },
  { value: 'female', label: 'Women' },
  { value: 'non_binary', label: 'Non-binary people' },
  { value: 'everyone', label: 'Everyone' },
]

/**
 * Step 1 — the basics. Name, birth date and who you are and are looking for.
 * The birth date is the 18+ gate: it is checked here by Zod and again by the
 * database CHECK on `profiles.date_of_birth`.
 */
export function BasicsStep({ draft, errors, update, saving, savedAt }: StepProps) {
  return (
    <div className="space-y-5">
      <div>
        <Input
          label="Full name"
          id="basics-full-name"
          value={draft.fullName}
          onChange={(event) => update({ fullName: event.target.value }, 'debounced')}
          error={errors.fullName}
          helperText="What other members will see. No phone numbers or addresses."
          autoComplete="name"
          maxLength={80}
          required
        />
      </div>

      <div>
        <Input
          label="Date of birth"
          id="basics-dob"
          type="date"
          value={draft.dateOfBirth}
          max={latestDateOfBirth()}
          onChange={(event) => update({ dateOfBirth: event.target.value }, 'immediate')}
          error={errors.dateOfBirth}
          helperText="You must be 18 or older to join. Your birth date is never shown publicly."
          required
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Select
          label="I am a"
          id="basics-gender"
          value={draft.gender}
          options={GENDER_OPTIONS}
          onChange={(event) => update({ gender: event.target.value as typeof draft.gender }, 'immediate')}
          error={errors.gender}
          required
        />
      </div>

      <fieldset>
        <legend className="block text-sm font-medium text-dark-300 mb-1.5">
          I am interested in <span className="text-primary-500" aria-hidden="true">*</span>
        </legend>
        <div className="flex flex-wrap gap-2" role="group" aria-label="I am interested in">
          {INTERESTED_IN_OPTIONS.map((option) => {
            const checked = draft.interestedIn.includes(option.value as (typeof draft.interestedIn)[number])
            return (
              <label
                key={option.value}
                className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dark-700 bg-dark-900/60 px-3 py-2 text-sm text-dark-200 transition hover:border-primary-500/40 data-[checked=true]:border-primary-500/60 data-[checked=true]:bg-primary-600/15"
                data-checked={checked || undefined}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  onChange={() => {
                    const next = checked
                      ? draft.interestedIn.filter((value) => value !== option.value)
                      : [...draft.interestedIn, option.value as (typeof draft.interestedIn)[number]]
                    update({ interestedIn: next }, 'immediate')
                  }}
                />
                <span
                  aria-hidden="true"
                  className={
                    checked
                      ? 'flex h-4 w-4 items-center justify-center rounded border border-primary-500 bg-primary-500 text-white'
                      : 'flex h-4 w-4 items-center justify-center rounded border border-dark-600'
                  }
                >
                  {checked && (
                    <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
                      <path d="M2.5 6.5 5 9l4.5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                {option.label}
              </label>
            )
          })}
        </div>
        {errors.interestedIn && (
          <p id="basics-interested-error" className="mt-1.5 text-sm text-red-400" role="alert">
            {errors.interestedIn}
          </p>
        )}
      </fieldset>

      <SaveStatus saving={saving} savedAt={savedAt} />
    </div>
  )
}

export function SaveStatus({ saving, savedAt }: { saving: boolean; savedAt: number | null }) {
  if (saving) {
    return <p className="text-xs text-dark-500" aria-live="polite">Saving…</p>
  }
  if (savedAt !== null) {
    return <p className="text-xs text-emerald-400" aria-live="polite">Saved</p>
  }
  return <p className="text-xs text-dark-600" aria-live="polite">Your changes save as you go.</p>
}