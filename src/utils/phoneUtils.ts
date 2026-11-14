/**
 * WhatsApp number handling for the onboarding contact step.
 *
 * The database stores phone numbers only in `private_contacts`, and only when
 * they pass the `is_e164` CHECK: `^\+[1-9][0-9]{7,14}$`. Everything that lives
 * in the browser drafts, validates and normalises toward that shape before it
 * is written.
 */

/** The default dial code used when the owner types a local number. */
export const DEFAULT_DIAL_CODE = '+91'

/** Exactly the shape `is_e164` enforces in the database. */
const E164_PATTERN = /^\+[1-9][0-9]{7,14}$/

/** What a raw input may be after light cleaning, before it is validated. */
export function stripPhoneFormatting(raw: string): string {
  return raw.trim().replace(/[\s\-().]/g, '')
}

/**
 * Normalises a raw input toward E.164. Returns `null` when the input is not a
 * usable number, so the caller can show an inline error rather than send it.
 *
 * Rules:
 *  - empty → null
 *  - `+`-prefixed → kept as-is, only validated
 *  - `00…` → treated as an international prefix and replaced with `+`
 *  - local `0…` → national number, prefixed with the default dial code
 *  - bare digits → assumed national, prefixed with the default dial code
 */
export function normalizeToE164(
  raw: string,
  dialCode: string = DEFAULT_DIAL_CODE
): string | null {
  const cleaned = stripPhoneFormatting(raw)
  if (!cleaned) return null

  let candidate: string
  if (cleaned.startsWith('+')) {
    candidate = cleaned
  } else if (cleaned.startsWith('00')) {
    candidate = `+${cleaned.slice(2)}`
  } else if (cleaned.startsWith('0')) {
    candidate = `${dialCode}${cleaned.slice(1)}`
  } else {
    candidate = `${dialCode}${cleaned}`
  }

  return E164_PATTERN.test(candidate) ? candidate : null
}

/** True when the value already satisfies the database's E.164 CHECK. */
export function isValidE164(value: string): boolean {
  return E164_PATTERN.test(value)
}

/** The human-readable hint shown under the input. */
export function dialCodeHint(dialCode: string = DEFAULT_DIAL_CODE): string {
  return `Country code ${dialCode} is added automatically for Indian numbers.`
}