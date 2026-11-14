import { z } from 'zod'
import { dateOfBirthSchema } from './validation'
import { normalizeToE164 } from './phoneUtils'

/**
 * Per-step validation for the onboarding wizard.
 *
 * Every limit below mirrors a CHECK constraint in the database (migration 02
 * for `profiles`, 03 for `private_contacts`): the client refuses bad input
 * before it is sent, and the database refuses it again if a future client
 * stops checking. The two layers are deliberate — RLS/CHECKs are the
 * enforcement, Zod is the UX.
 */

/**
 * True when a name holds a control character or an angle bracket — the same
 * check as `is_plain_name` in the database. Written as a code-point scan, not
 * a regex literal, so the characters never appear in a regex (and a name can
 * never smuggle itself into markup downstream).
 */
export function hasControlOrAngleBracket(name: string): boolean {
  for (const char of name) {
    const code = char.codePointAt(0) ?? 0
    if (code < 32 || code === 127 || char === '<' || char === '>') return true
  }
  return false
}

/** `is_plain_name`: 1–80 chars, no control characters or angle brackets. */
export const fullNameSchema = z
  .string()
  .trim()
  .min(1, 'Your name is required')
  .max(80, `Names must be under 80 characters`)
  .refine((name) => !hasControlOrAngleBracket(name), "Names can't contain angle brackets or control characters")

export const interestedInSchema = z
  .array(z.enum(['male', 'female', 'non_binary', 'everyone']))
  .min(1, 'Select at least one')

export const basicsStepSchema = z.object({
  fullName: fullNameSchema,
  dateOfBirth: dateOfBirthSchema,
  gender: z.enum(['male', 'female', 'non_binary', 'prefer_not_to_say'], {
    message: 'Select a gender',
  }),
  interestedIn: interestedInSchema,
})

export const locationStepSchema = z.object({
  // 1–120 chars, matching `profiles_city_length`.
  locationCity: z
    .string()
    .trim()
    .min(1, 'Your city is required')
    .max(120, 'City names must be under 120 characters'),
  // ≤120 chars, nullable.
  locationState: z
    .string()
    .trim()
    .max(120, 'State names must be under 120 characters')
    .optional()
    .or(z.literal('')),
  // 2–80 chars, matching `profiles_country_length`.
  locationCountry: z
    .string()
    .trim()
    .min(2, 'Your country is required')
    .max(80, 'Country names must be under 80 characters'),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
})

export const aboutStepSchema = z.object({
  // ≤500 chars, matching `profiles_bio_length`.
  bio: z
    .string()
    .max(500, 'Your bio must be under 500 characters')
    .optional()
    .or(z.literal('')),
  heightCm: z
    .number()
    .min(90, 'Height must be between 90 and 250 cm')
    .max(250, 'Height must be between 90 and 250 cm')
    .nullable()
    .optional(),
  education: z.string().trim().max(120, 'Education must be under 120 characters').optional().or(z.literal('')),
  occupation: z.string().trim().max(120, 'Occupation must be under 120 characters').optional().or(z.literal('')),
  languages: z.array(z.string().trim().max(40)).max(10, 'You can list at most 10 languages'),
})

export const interestsStepSchema = z.object({
  interests: z
    .array(z.string().max(40, 'Interests must be under 40 characters'))
    .min(5, 'Pick at least 5 interests')
    .max(10, 'You can pick at most 10 interests'),
  smoking: z.enum(['never', 'occasionally', 'regularly', 'quitting']),
  drinking: z.enum(['never', 'socially', 'regularly', 'quitting']),
  exercise: z.enum(['never', 'sometimes', 'often', 'daily']),
})

export const lookingForStepSchema = z.object({
  lookingFor: z.enum(['casual', 'serious', 'friends', 'unsure'], {
    message: 'Choose what you are looking for',
  }),
})

/** A cleaned phone value, or null when the owner keeps it empty. */
export const phoneInputSchema = z
  .string()
  .trim()
  .max(17, 'That phone number looks too long')
  .refine((value) => value === '' || normalizeToE164(value) !== null, {
    message: 'Enter a full number with its country code, starting with +',
  })

export const contactStepSchema = z.object({
  whatsappNumber: phoneInputSchema.optional(),
  shareMode: z.enum(['never', 'matches', 'approved']),
  whatsappConsent: z.boolean(),
})

/** A human-readable line for the photo upload progress bar. */
export function progressLabel(percent: number): string {
  if (percent <= 0) return 'Preparing your photo…'
  if (percent >= 100) return 'Almost done…'
  return `Uploading… ${Math.min(percent, 100)}%`
}

/** The single draft shape the whole wizard edits. */
export interface OnboardingDraft {
  fullName: string
  dateOfBirth: string
  gender: 'male' | 'female' | 'non_binary' | 'prefer_not_to_say'
  interestedIn: ('male' | 'female' | 'non_binary' | 'everyone')[]
  locationCity: string
  locationState: string
  locationCountry: string
  latitude: number | null
  longitude: number | null
  bio: string
  heightCm: number | null
  education: string
  occupation: string
  languages: string[]
  interests: string[]
  smoking: 'never' | 'occasionally' | 'regularly' | 'quitting'
  drinking: 'never' | 'socially' | 'regularly' | 'quitting'
  exercise: 'never' | 'sometimes' | 'often' | 'daily'
  lookingFor: 'casual' | 'serious' | 'friends' | 'unsure'
  whatsappNumber: string
  shareMode: 'never' | 'matches' | 'approved'
  whatsappConsent: boolean
}

export type StepKey =
  | 'basics'
  | 'location'
  | 'about'
  | 'interests'
  | 'lookingFor'
  | 'photos'
  | 'contact'
  | 'review'

/** Which schema validates each text/form step (photos are validated live). */
export const STEP_SCHEMAS: Record<
  Exclude<StepKey, 'photos' | 'review'>,
  z.ZodType<Partial<OnboardingDraft>>
> = {
  basics: basicsStepSchema,
  location: locationStepSchema,
  about: aboutStepSchema,
  interests: interestsStepSchema,
  lookingFor: lookingForStepSchema,
  contact: contactStepSchema,
}