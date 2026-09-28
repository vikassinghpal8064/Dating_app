import { z } from 'zod'

/**
 * One source of truth for the password policy. The schema below and the
 * live checklist rendered on the sign-up and reset screens both read from this
 * array, so the UI can never drift from what is actually enforced.
 */
export const PASSWORD_REQUIREMENTS = [
  { id: 'length', label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { id: 'uppercase', label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { id: 'lowercase', label: 'One lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { id: 'number', label: 'One number', test: (p: string) => /[0-9]/.test(p) },
  { id: 'special', label: 'One special character', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
] as const

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character')

/** HeartConnect is 18+. The same floor is re-checked by a database CHECK. */
export const MINIMUM_AGE = 18

export const UNDERAGE_MESSAGE = `You must be at least ${MINIMUM_AGE} years old`

export function ageFromDateOfBirth(dateOfBirth: string, today = new Date()): number {
  const birth = new Date(dateOfBirth)
  if (Number.isNaN(birth.getTime())) return Number.NaN

  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1
  }
  return age
}

/** The latest date of birth a person may enter, as `YYYY-MM-DD`. */
export function latestDateOfBirth(today = new Date()): string {
  const cutoff = new Date(today)
  cutoff.setFullYear(cutoff.getFullYear() - MINIMUM_AGE)
  return cutoff.toISOString().slice(0, 10)
}

export const dateOfBirthSchema = z
  .string()
  .min(1, 'Date of birth is required')
  .refine((date) => !Number.isNaN(new Date(date).getTime()), 'Enter a valid date')
  .refine(
    (date) => {
      const age = ageFromDateOfBirth(date)
      return !Number.isNaN(age) && age >= MINIMUM_AGE
    },
    UNDERAGE_MESSAGE
  )

export const signUpSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: passwordSchema,
  confirmPassword: z.string(),
  fullName: z.string().min(2, 'Name must be at least 2 characters').max(50, 'Name must be less than 50 characters'),
  dateOfBirth: dateOfBirthSchema,
  gender: z.enum(['male', 'female', 'non_binary', 'prefer_not_to_say']),
  interestedIn: z.array(z.enum(['male', 'female', 'non_binary', 'everyone'])).min(1, 'Select at least one preference'),
  locationCity: z.string().min(2, 'City is required'),
  locationCountry: z.string().min(2, 'Country is required'),
  // `boolean` + refine keeps the form's default value typeable while still
  // refusing anything other than an explicit tick.
  termsAccepted: z.boolean().refine((accepted) => accepted, 'You must accept the terms and conditions'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

/** The most photos a profile may carry. */
export const MAX_PHOTOS = 6

export const photoUrlSchema = z
  .string()
  .trim()
  .url('Enter a full image URL, starting with https://')
  .refine((url) => /^https:\/\//i.test(url), 'Photos must be served over https')
  .refine((url) => url.length <= 2048, 'That URL is too long')

export const profileSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters').max(50, 'Name must be less than 50 characters'),
  bio: z.string().max(500, 'Bio must be less than 500 characters').optional(),
  locationCity: z.string().min(2, 'City is required'),
  locationCountry: z.string().min(2, 'Country is required'),
  showDistance: z.boolean(),
  interestedIn: z.array(z.enum(['male', 'female', 'non_binary', 'everyone'])).min(1, 'Select at least one preference'),
  photos: z.array(photoUrlSchema).max(MAX_PHOTOS, `You can have at most ${MAX_PHOTOS} photos`),
})

export const preferencesSchema = z.object({
  minAge: z.number().min(MINIMUM_AGE, `Minimum age must be at least ${MINIMUM_AGE}`).max(99, 'Maximum age is 99'),
  maxAge: z.number().min(MINIMUM_AGE, `Maximum age must be at least ${MINIMUM_AGE}`).max(99, 'Maximum age is 99'),
  maxDistanceKm: z.number().min(1, 'Distance must be at least 1 km').max(500, 'Maximum distance is 500 km'),
  showMeTo: z.enum(['everyone', 'interested_in_me', 'matches_only']),
  notifications: z.object({
    newMatch: z.boolean(),
    newMessage: z.boolean(),
    whatsappRequest: z.boolean(),
    profileLiked: z.boolean(),
  }),
  privacy: z.object({
    showDistance: z.boolean(),
    showOnlineStatus: z.boolean(),
    showLastActive: z.boolean(),
  }),
}).refine((data) => data.minAge <= data.maxAge, {
  message: 'Minimum age cannot be greater than maximum age',
  path: ['maxAge'],
})

export const messageSchema = z.object({
  content: z.string().min(1, 'Message cannot be empty').max(2000, 'Message too long'),
})

export const whatsappRequestSchema = z.object({
  whatsappNumber: z.string()
    .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format')
    .min(10, 'Phone number too short')
    .max(15, 'Phone number too long'),
})

export type SignUpInput = z.infer<typeof signUpSchema>
export type SignInInput = z.infer<typeof signInSchema>
export type ProfileInput = z.infer<typeof profileSchema>
export type PreferencesInput = z.infer<typeof preferencesSchema>
export type MessageInput = z.infer<typeof messageSchema>
export type WhatsAppRequestInput = z.infer<typeof whatsappRequestSchema>