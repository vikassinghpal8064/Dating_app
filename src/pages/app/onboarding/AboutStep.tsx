import { useMemo, useState } from 'react'
import { HEIGHT_OPTIONS, LANGUAGES } from '../../../data/onboardingOptions'
import { Input, Select, Textarea } from '../../../components/ui'
import { SuggestionInput } from './SuggestionInput'
import type { StepProps } from './types'

const MAX_BIO = 500

/**
 * Step 3 — the story. Bio is free text with a live 500-character counter,
 * height is a fixed-range select, education/occupation are plain text, and
 * languages are a searchable picker that appends the chosen value to a chip
 * list. The DB constrains everything again (bio ≤ 500, height 90–250,
 * ≤ 10 languages), so the client limits are UX, not security.
 */
export function AboutStep({ draft, errors, update, savedAt, saving }: StepProps) {
  const [languageInput, setLanguageInput] = useState('')

  const remaining = MAX_BIO - draft.bio.length
  const languageSuggestions = useMemo(() => {
    const picked = new Set(draft.languages)
    return LANGUAGES.filter((language) => !picked.has(language))
  }, [draft.languages])

  const addLanguage = (value: string) => {
    const clean = value.trim()
    if (!clean) return
    if (draft.languages.includes(clean)) {
      setLanguageInput('')
      return
    }
    const next = [...draft.languages, clean].slice(0, 10)
    update({ languages: next }, 'immediate')
    setLanguageInput('')
  }

  const removeLanguage = (value: string) => {
    update({ languages: draft.languages.filter((language) => language !== value) }, 'immediate')
  }

  return (
    <div className="space-y-5">
      <div>
        <Textarea
          label="About me"
          id="about-bio"
          value={draft.bio}
          maxLength={MAX_BIO}
          onChange={(event) => update({ bio: event.target.value }, 'debounced')}
          error={errors.bio}
          helperText="What would make a good first date with you? Keep it honest."
          placeholder="Tell people a little about what lights you up…"
        />
        <p className="mt-1.5 text-right text-xs text-dark-500" aria-live="polite">
          <span className={remaining < 0 ? 'text-red-400' : ''}>{draft.bio.length}</span>/{MAX_BIO}
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Select
          label="Height"
          id="about-height"
          value={draft.heightCm === null ? '' : String(draft.heightCm)}
          options={HEIGHT_OPTIONS}
          placeholder="Choose…"
          onChange={(event) => {
            const value = event.target.value
            update({ heightCm: value === '' ? null : Number(value) }, 'immediate')
          }}
          error={errors.heightCm}
          helperText="Optional."
        />
        <Input
          label="Education"
          id="about-education"
          value={draft.education}
          onChange={(event) => update({ education: event.target.value }, 'debounced')}
          error={errors.education}
          placeholder="e.g. B.Tech, University of Delhi"
          maxLength={120}
        />
      </div>

      <Input
        label="Occupation"
        id="about-occupation"
        value={draft.occupation}
        onChange={(event) => update({ occupation: event.target.value }, 'debounced')}
        error={errors.occupation}
        placeholder="What do you do? (optional)"
        maxLength={120}
      />

      <div>
        <SuggestionInput
          label="Languages"
          id="about-languages"
          value={languageInput}
          suggestions={languageSuggestions}
          onChange={setLanguageInput}
          helperText={draft.languages.length >= 10 ? 'You can list at most 10 languages.' : 'Pick or type a language and press Enter.'}
        />
        {draft.languages.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2" aria-label="Selected languages">
            {draft.languages.map((language) => (
              <li
                key={language}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary-500/40 bg-primary-600/15 px-3 py-1 text-sm text-primary-300"
              >
                {language}
                <button
                  type="button"
                  onClick={() => removeLanguage(language)}
                  className="rounded-full p-0.5 transition-colors hover:bg-primary-500/20"
                  aria-label={`Remove ${language}`}
                >
                  <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" aria-hidden="true">
                    <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
        {languageInput.trim() && (
          <button
            type="button"
            onMouseDown={(event) => {
              // Keep the input focused while the press is in progress: the
              // suggestion listbox sits *in flow* below the input, so blurring
              // it (which unmounts the list) would shift the layout under the
              // cursor and swallow the click that follows the press.
              event.preventDefault()
            }}
            onClick={() => addLanguage(languageInput)}
            className="mt-2 text-sm font-medium text-primary-400 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-400"
          >
            Add “{languageInput.trim()}”
          </button>
        )}
        {errors.languages && (
          <p className="mt-1.5 text-sm text-red-400" role="alert">
            {errors.languages}
          </p>
        )}
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