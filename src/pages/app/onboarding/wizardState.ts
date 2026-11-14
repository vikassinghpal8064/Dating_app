import { ageFromDateOfBirth } from '../../../utils/validation'
import type { EditableProfileFields } from '../../../lib/authContext'
import type { OnboardingDraft, StepKey } from '../../../utils/onboardingSchemas'
import { STEP_SCHEMAS } from '../../../utils/onboardingSchemas'
import type { UserProfile } from '../../../types'

/**
 * Pure wizard state helpers: turning the persisted profile into the editable
 * draft, projecting draft fields back onto profile columns, and deciding what
 * is safe to auto-save before the server would reject it.
 *
 * Nothing in this module touches the browser, so it is covered by unit tests.
 */

/** A draft initialised from a saved profile — the resume path. */
export function draftFromProfile(user: UserProfile): OnboardingDraft {
  return {
    fullName: user.full_name ?? '',
    dateOfBirth: user.date_of_birth ?? '',
    gender: user.gender ?? 'prefer_not_to_say',
    interestedIn: user.interested_in ?? [],
    locationCity: user.location_city ?? '',
    locationState: user.location_state ?? '',
    locationCountry: user.location_country ?? '',
    latitude: user.latitude,
    longitude: user.longitude,
    bio: user.bio ?? '',
    heightCm: user.height_cm ?? null,
    education: user.education ?? '',
    occupation: user.occupation ?? '',
    languages: user.languages ?? [],
    interests: user.interests ?? [],
    smoking: user.smoking ?? 'never',
    drinking: user.drinking ?? 'socially',
    exercise: user.exercise ?? 'sometimes',
    lookingFor: user.looking_for ?? 'unsure',
    whatsappNumber: '',
    shareMode: 'never',
    whatsappConsent: user.whatsapp_consent ?? false,
  }
}

/** Projects a *safe* draft field back onto its profile column(s). */
export function patchToProfile(patch: Partial<OnboardingDraft>): EditableProfileFields {
  const out: EditableProfileFields = {}

  if (patch.fullName !== undefined && patch.fullName.trim() !== '') {
    out.full_name = patch.fullName.trim()
  }
  if (patch.dateOfBirth !== undefined && isValidStoredDate(patch.dateOfBirth)) {
    out.date_of_birth = patch.dateOfBirth
  }
  if (patch.gender !== undefined) out.gender = patch.gender
  if (patch.interestedIn !== undefined && patch.interestedIn.length > 0) {
    out.interested_in = patch.interestedIn
  }
  if (patch.locationCity !== undefined && patch.locationCity.trim() !== '') {
    out.location_city = patch.locationCity.trim()
  }
  if (patch.locationState !== undefined) {
    out.location_state = patch.locationState.trim() === '' ? null : patch.locationState.trim()
  }
  if (patch.locationCountry !== undefined && patch.locationCountry.trim().length >= 2) {
    out.location_country = patch.locationCountry.trim()
  }
  if (patch.latitude !== undefined && patch.longitude !== undefined) {
    // The DB CHECKs enforce this server-side too; rounding client-side keeps a
    // bad value from ever leaving the browser. Skip a partial pair — writing a
    // coordinate without its partner would pin the marker to a wrong spot.
    if (patch.latitude !== null && patch.longitude !== null) {
      out.latitude = Math.round(patch.latitude * 100) / 100
      out.longitude = Math.round(patch.longitude * 100) / 100
    }
  }
  if (patch.bio !== undefined) out.bio = patch.bio
  if (patch.heightCm !== undefined) {
    // Nulled out (cleared) or within the DB's 90–250 band both persist; the
    // wizard's select can only ever produce those two states.
    if (patch.heightCm === null || (patch.heightCm >= 90 && patch.heightCm <= 250)) {
      out.height_cm = patch.heightCm
    }
  }
  if (patch.education !== undefined) {
    out.education = patch.education.trim() === '' ? null : patch.education.trim()
  }
  if (patch.occupation !== undefined) {
    out.occupation = patch.occupation.trim() === '' ? null : patch.occupation.trim()
  }
  if (patch.languages !== undefined && patch.languages.length <= 10) {
    out.languages = patch.languages
  }
  if (patch.interests !== undefined && patch.interests.length <= 20) {
    out.interests = patch.interests
  }
  if (patch.smoking !== undefined) out.smoking = patch.smoking
  if (patch.drinking !== undefined) out.drinking = patch.drinking
  if (patch.exercise !== undefined) out.exercise = patch.exercise
  if (patch.lookingFor !== undefined) out.looking_for = patch.lookingFor
  if (patch.whatsappConsent !== undefined) out.whatsapp_consent = patch.whatsappConsent

  return out
}

/** Only a complete, adult, parseable date may be written to the profile. */
function isValidStoredDate(date: string): boolean {
  if (!date || Number.isNaN(new Date(date).getTime())) return false
  const age = ageFromDateOfBirth(date)
  return !Number.isNaN(age) && age >= 18
}

export type StepValidation =
  | Exclude<StepKey, 'photos' | 'review'>

/** Validates the edit-able part of a step against its schema. */
export function validateStep(
  step: StepValidation,
  draft: OnboardingDraft
): { ok: boolean; errors: Record<string, string> } {
  const schema = STEP_SCHEMAS[step]
  const result = schema.safeParse(draft)
  if (result.success) return { ok: true, errors: {} }

  const errors: Record<string, string> = {}
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? step)
    if (!errors[key]) errors[key] = issue.message
  }
  return { ok: Object.keys(errors).length === 0, errors }
}