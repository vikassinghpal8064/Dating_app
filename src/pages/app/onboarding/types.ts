import type { OnboardingDraft } from '../../../utils/onboardingSchemas'

/**
 * Props every form step receives.
 *
 * `update` merges a partial draft and persists it. `mode` decides when:
 *  - `'immediate'` — discrete selections (chips, radios, toggles, selects)
 *    write to the database right away, so a member who leaves mid-wizard
 *    keeps what they chose.
 *  - `'debounced'` — free text (name, bio, city, education, occupation) is
 *    written ~800ms after the last keystroke, so typing does not hammer the
 *    API with one UPDATE per character.
 *
 * `errors` are the current step's validation messages, keyed by field name,
 * and `savedAt` is a timestamp bump the shell sends down whenever a write
 * lands, so steps can present an honest "Saved" affordance.
 */
export interface StepProps {
  draft: OnboardingDraft
  errors: Record<string, string>
  update: (patch: Partial<OnboardingDraft>, mode?: 'immediate' | 'debounced') => void
  savedAt: number | null
  saving: boolean
}