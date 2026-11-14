import { Toggle, Select, Input } from '../../../components/ui'
import { dialCodeHint } from '../../../utils/phoneUtils'
import type { StepProps } from './types'

const SHARE_MODE_OPTIONS = [
  { value: 'never', label: 'No one' },
  { value: 'matches', label: 'People I match with' },
  { value: 'approved', label: 'Only after I approve them' },
]

/**
 * Step 7 — contact preference. Optional, and private by design: the number
 * lives only in `private_contacts` (never on `profiles`), a row-level-secured
 * table only its owner can read, and it is released to a match only by the
 * consent-checking database function. The toggle is the owner's opt-in gate.
 */
export function ContactStep({ draft, errors, update, savedAt, saving }: StepProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-dark-700 bg-dark-900/60 p-5">
        <Toggle
          id="contact-consent"
          label="Share my WhatsApp number with matches"
          description="Turn this on to let people you match with request your number. The number is never shown on your profile and never visible to people you have not matched with."
          checked={draft.whatsappConsent}
          onChange={(event) => update({ whatsappConsent: event.target.checked }, 'immediate')}
        />
      </div>

      {draft.whatsappConsent && (
        <div className="space-y-5">
          <Input
            label="WhatsApp number"
            id="contact-number"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={draft.whatsappNumber}
            placeholder="+91 98765 43210"
            onChange={(event) => update({ whatsappNumber: event.target.value }, 'debounced')}
            error={errors.whatsappNumber}
            helperText={dialCodeHint()}
            maxLength={17}
          />

          <div>
            <Select
              label="Who can see it"
              id="contact-share-mode"
              value={draft.shareMode}
              options={SHARE_MODE_OPTIONS}
              onChange={(event) => update({ shareMode: event.target.value as typeof draft.shareMode }, 'immediate')}
            />
            <p className="mt-1.5 text-xs leading-relaxed text-dark-500">
              How strictly your number is released. You can change this at any time in settings.
            </p>
          </div>
        </div>
      )}

      <SaveStatus saving={saving} savedAt={savedAt} />
    </div>
  )
}

function SaveStatus({ saving, savedAt }: { saving: boolean; savedAt: number | null }) {
  if (saving) return <p className="text-xs text-dark-500" aria-live="polite">Saving…</p>
  if (savedAt !== null) return <p className="text-xs text-emerald-400" aria-live="polite">Saved</p>
  return <p className="text-xs text-dark-600" aria-live="polite">Your changes save as you go.</p>
}