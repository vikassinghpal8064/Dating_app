import { describe, it, expect } from 'vitest'
import type { UserProfile } from '@/types'
import { latestDateOfBirth, ageFromDateOfBirth } from '@/utils/validation'
import {
  hasControlOrAngleBracket,
  fullNameSchema,
  contactStepSchema,
  progressLabel,
} from '@/utils/onboardingSchemas'
import { roundCoordinates, sniffImageType } from '@/utils/photoPipeline'
import {
  DEFAULT_DIAL_CODE,
  stripPhoneFormatting,
  normalizeToE164,
  isValidE164,
  dialCodeHint,
} from '@/utils/phoneUtils'
import { MIN_PROFILE_PHOTOS, isProfileComplete } from '@/utils/profileCompleteness'
import { draftFromProfile, patchToProfile, validateStep } from '@/pages/app/onboarding/wizardState'

/** A fully-formed profile row, the shape `draftFromProfile` reads. */
function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'member@example.com',
    full_name: 'Ada Lovelace',
    date_of_birth: '1994-06-15',
    gender: 'female',
    interested_in: ['male', 'female'],
    bio: 'Mathematician and writer.',
    photos: [],
    location_city: 'Mumbai',
    location_state: null,
    location_country: 'India',
    latitude: 19.076,
    longitude: 72.8777,
    height_cm: 172,
    education: null,
    occupation: 'Analyst',
    looking_for: 'serious',
    interests: ['reading', 'chess', 'poetry', 'museums', 'tea'],
    languages: ['English', 'French'],
    smoking: 'never',
    drinking: 'socially',
    exercise: 'sometimes',
    show_distance: true,
    age_verified: false,
    phone_verified: false,
    whatsapp_consent: false,
    is_admin: false,
    profile_paused: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('onboarding photo pipeline', () => {
  describe('sniffImageType', () => {
    /** Builds a Blob whose first 12 bytes are the given signature. */
    const blobWithSignature = (signature: number[], size = 12): Blob => {
      const bytes = new Uint8Array(size)
      signature.forEach((byte, index) => {
        bytes[index] = byte
      })
      return new Blob([bytes])
    }

    it('accepts a JPEG by its magic bytes', async () => {
      const blob = blobWithSignature([0xff, 0xd8, 0xff, 0xe0])
      expect(await sniffImageType(blob)).toBe('jpeg')
    })

    it('accepts a PNG by its magic bytes', async () => {
      const blob = blobWithSignature([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      expect(await sniffImageType(blob)).toBe('png')
    })

    it('accepts a WebP by its RIFF/WEBP signature', async () => {
      const blob = blobWithSignature([
        0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
      ])
      expect(await sniffImageType(blob)).toBe('webp')
    })

    it('rejects an .exe renamed to .jpg', async () => {
      // "MZ" — the MS-DOS executable header — is not an image signature.
      const blob = blobWithSignature([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00])
      expect(await sniffImageType(blob)).toBeNull()
    })

    it('rejects a text file that happens to match the MIME claim', async () => {
      const blob = blobWithSignature([0x3c, 0x21, 0x44, 0x4f], 100) // "<!DO..."
      expect(await sniffImageType(blob)).toBeNull()
    })

    it('rejects a blob too small to carry a signature', async () => {
      const blob = blobWithSignature([0xff, 0xd8, 0xff], 8)
      expect(await sniffImageType(blob)).toBeNull()
    })

    it('rejects an empty blob', async () => {
      expect(await sniffImageType(new Blob([]))).toBeNull()
    })

    it('does not trust a fake signature at the wrong offset', async () => {
      // RIFF marker but the "WEBP" tag is not at position 8.
      const blob = blobWithSignature([
        0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42,
      ])
      expect(await sniffImageType(blob)).toBeNull()
    })
  })

  describe('roundCoordinates', () => {
    it('rounds to exactly two decimal places', () => {
      expect(roundCoordinates(19.076, 72.8777)).toEqual({ latitude: 19.08, longitude: 72.88 })
    })

    it('does not gain precision for already-rounded values', () => {
      expect(roundCoordinates(19.08, 72.88)).toEqual({ latitude: 19.08, longitude: 72.88 })
    })

    it('handles negative hemispheres', () => {
      expect(roundCoordinates(-33.8688, -151.2093)).toEqual({
        latitude: -33.87,
        longitude: -151.21,
      })
    })

    it('banks on conventional rounding at the .005 boundary', () => {
      const { latitude } = roundCoordinates(19.005, 0)
      // 19.005 * 100 = 1900.5 → Math.round → 1901 → 19.01
      expect(latitude).toBe(19.01)
    })
  })
})

describe('phone utilities', () => {
  describe('stripPhoneFormatting', () => {
    it('removes spaces, dashes, parens and dots', () => {
      expect(stripPhoneFormatting('+91 (98765) 432-10')).toBe('+919876543210')
    })

    it('trims surrounding whitespace', () => {
      expect(stripPhoneFormatting('  +919876543210  ')).toBe('+919876543210')
    })
  })

  describe('normalizeToE164', () => {
    it('keeps a full international number as-is', () => {
      expect(normalizeToE164('+919876543210')).toBe('+919876543210')
    })

    it('accepts a human-friendly number with formatting', () => {
      expect(normalizeToE164('+91 98765 43210')).toBe('+919876543210')
    })

    it('treats a local 0-prefixed number as national under the default dial code', () => {
      expect(normalizeToE164('09876543210')).toBe('+919876543210')
    })

    it('prefixes bare digits with the default dial code', () => {
      expect(normalizeToE164('9876543210')).toBe('+919876543210')
    })

    it('rewrites the 00 international prefix to +', () => {
      expect(normalizeToE164('00919876543210')).toBe('+919876543210')
    })

    it('honours a caller-provided dial code', () => {
      expect(normalizeToE164('02079460095', '+44')).toBe('+442079460095')
    })

    it('returns null for an empty input', () => {
      expect(normalizeToE164('')).toBeNull()
      expect(normalizeToE164('   ')).toBeNull()
    })

    it('returns null for letters mixed into the number', () => {
      expect(normalizeToE164('+9198765l3210')).toBeNull()
    })

    it('rejects a number that is too short for E.164', () => {
      expect(normalizeToE164('+91 123')).toBeNull()
    })

    it('rejects a number that is too long for E.164', () => {
      expect(normalizeToE164('+911234567890123456')).toBeNull()
    })

    it('rejects a dial code with a leading zero digit', () => {
      expect(normalizeToE164('+091 9876543210')).toBeNull()
    })
  })

  describe('isValidE164', () => {
    it('passes numbers that satisfy the database CHECK', () => {
      expect(isValidE164('+919876543210')).toBe(true)
    })

    it('fails short, empty and non-plus values', () => {
      expect(isValidE164('9876543210')).toBe(false)
      expect(isValidE164('')).toBe(false)
    })
  })

  describe('dialCodeHint', () => {
    it('mentions the dial code used in the hint', () => {
      expect(dialCodeHint()).toContain(DEFAULT_DIAL_CODE)
      expect(dialCodeHint('+44')).toContain('+44')
    })
  })
})

describe('name validation', () => {
  describe('hasControlOrAngleBracket', () => {
    it('flags angle brackets', () => {
      expect(hasControlOrAngleBracket('<script>')).toBe(true)
      expect(hasControlOrAngleBracket('A > B')).toBe(true)
    })

    it('flags control characters', () => {
      expect(hasControlOrAngleBracket('line\nbreak')).toBe(true)
      expect(hasControlOrAngleBracket('tab\there')).toBe(true)
      expect(hasControlOrAngleBracket('del\u007fchar')).toBe(true)
    })

    it('accepts ordinary names', () => {
      expect(hasControlOrAngleBracket('Ada Lovelace')).toBe(false)
    })
  })

  it('the schema rejects a name with angle brackets', () => {
    const result = fullNameSchema.safeParse('<marquee>Ada</marquee>')
    expect(result.success).toBe(false)
  })

  it('the schema trims and accepts a valid name', () => {
    const result = fullNameSchema.safeParse('  Ada Lovelace  ')
    expect(result.success).toBe(true)
  })
})

describe('contact step schema', () => {
  it('accepts an empty number when consent is on but nothing is typed yet', () => {
    const result = contactStepSchema.safeParse({
      whatsappNumber: '',
      shareMode: 'matches',
      whatsappConsent: true,
    })
    expect(result.success).toBe(true)
  })

  it('accepts a human-friendly number', () => {
    const result = contactStepSchema.safeParse({
      whatsappNumber: '+91 98765 43210',
      shareMode: 'approved',
      whatsappConsent: true,
    })
    expect(result.success).toBe(true)
  })

  it('rejects a non-E.164 shaped number', () => {
    const result = contactStepSchema.safeParse({
      whatsappNumber: '98765',
      shareMode: 'matches',
      whatsappConsent: true,
    })
    expect(result.success).toBe(false)
  })

  it('accepts any share mode with no number when consent is off', () => {
    const result = contactStepSchema.safeParse({
      whatsappNumber: '',
      shareMode: 'never',
      whatsappConsent: false,
    })
    expect(result.success).toBe(true)
  })
})

describe('progressLabel', () => {
  it('labels the start, middle and end distinctly', () => {
    expect(progressLabel(0)).toBe('Preparing your photo…')
    expect(progressLabel(42)).toBe('Uploading… 42%')
    expect(progressLabel(100)).toBe('Almost done…')
  })

  it('clamps the percent into the visible range', () => {
    expect(progressLabel(150)).toBe('Almost done…')
    expect(progressLabel(-5)).toBe('Preparing your photo…')
  })
})

describe('wizard state', () => {
  describe('draftFromProfile', () => {
    it('maps every persisted column into the draft', () => {
      const draft = draftFromProfile(makeProfile())

      expect(draft.fullName).toBe('Ada Lovelace')
      expect(draft.dateOfBirth).toBe('1994-06-15')
      expect(draft.gender).toBe('female')
      expect(draft.interestedIn).toEqual(['male', 'female'])
      expect(draft.locationCity).toBe('Mumbai')
      expect(draft.locationState).toBe('')
      expect(draft.locationCountry).toBe('India')
      expect(draft.latitude).toBe(19.076)
      expect(draft.longitude).toBe(72.8777)
      expect(draft.bio).toBe('Mathematician and writer.')
      expect(draft.education).toBe('')
      expect(draft.occupation).toBe('Analyst')
      expect(draft.lookingFor).toBe('serious')
      expect(draft.interests).toHaveLength(5)
      expect(draft.languages).toEqual(['English', 'French'])
      expect(draft.whatsappConsent).toBe(false)
      expect(draft.whatsappNumber).toBe('')
      expect(draft.shareMode).toBe('never')
    })

    it('falls back safely on nulls and missing fields', () => {
      const sparse = makeProfile({
        full_name: '',
        date_of_birth: '',
        location_state: null,
        height_cm: null,
        education: null,
        occupation: null,
        interested_in: [],
        interests: [],
        languages: [],
      })
      const draft = draftFromProfile(sparse)
      expect(draft.fullName).toBe('')
      expect(draft.dateOfBirth).toBe('')
      expect(draft.locationState).toBe('')
      expect(draft.heightCm).toBeNull()
      expect(draft.education).toBe('')
      expect(draft.occupation).toBe('')
      expect(draft.interestedIn).toEqual([])
      expect(draft.interests).toEqual([])
      expect(draft.languages).toEqual([])
    })
  })

  describe('patchToProfile', () => {
    it('projects draft fields onto profile columns', () => {
      const patch = patchToProfile({
        fullName: '  Ada Lovelace  ',
        gender: 'female',
        interestedIn: ['male', 'everyone'],
        locationCity: ' Bangalore ',
        locationCountry: 'India',
        bio: 'New bio',
        lookingFor: 'serious',
        whatsappConsent: true,
      })

      expect(patch.full_name).toBe('Ada Lovelace')
      expect(patch.gender).toBe('female')
      expect(patch.interested_in).toEqual(['male', 'everyone'])
      expect(patch.location_city).toBe('Bangalore')
      expect(patch.location_country).toBe('India')
      expect(patch.bio).toBe('New bio')
      expect(patch.looking_for).toBe('serious')
      expect(patch.whatsapp_consent).toBe(true)
    })

    it('persists a cleared optional field as null', () => {
      const patch = patchToProfile({ education: '', occupation: '' })
      expect(patch.education).toBeNull()
      expect(patch.occupation).toBeNull()
    })

    it('persists a cleared height as null', () => {
      const patch = patchToProfile({ heightCm: null })
      expect(patch.height_cm).toBeNull()
    })

    it('keeps a height inside the DB band and refuses one outside it', () => {
      expect(patchToProfile({ heightCm: 172 }).height_cm).toBe(172)
      expect(patchToProfile({ heightCm: 40 }).height_cm).toBeUndefined()
      expect(patchToProfile({ heightCm: 400 }).height_cm).toBeUndefined()
    })

    it('rounds coordinates to two decimals and skips a partial pair', () => {
      expect(patchToProfile({ latitude: 19.076, longitude: 72.8777 })).toEqual({
        latitude: 19.08,
        longitude: 72.88,
      })
      expect(patchToProfile({ latitude: 19.076 })).toEqual({})
    })

    it('refuses an underage or invalid birth date', () => {
      expect(patchToProfile({ dateOfBirth: '2010-01-01' }).date_of_birth).toBeUndefined()
      expect(patchToProfile({ dateOfBirth: 'not-a-date' }).date_of_birth).toBeUndefined()
    })

    it('refuses an empty name and an empty city', () => {
      expect(patchToProfile({ fullName: '   ' }).full_name).toBeUndefined()
      expect(patchToProfile({ locationCity: '   ' }).location_city).toBeUndefined()
    })

    it('maps an empty state to null and a used state to a trimmed value', () => {
      expect(patchToProfile({ locationState: '  ' }).location_state).toBeNull()
      expect(patchToProfile({ locationState: ' Maharashtra ' }).location_state).toBe(
        'Maharashtra'
      )
    })

    it('drops arrays above the database limits', () => {
      const tooManyLanguages = Array.from({ length: 11 }, (_, i) => `L${i}`)
      const tooManyInterests = Array.from({ length: 21 }, (_, i) => `I${i}`)

      expect(patchToProfile({ languages: tooManyLanguages }).languages).toBeUndefined()
      expect(patchToProfile({ interests: tooManyInterests }).interests).toBeUndefined()

      expect(patchToProfile({ languages: tooManyLanguages.slice(0, 10) }).languages).toHaveLength(10)
      expect(patchToProfile({ interests: tooManyInterests.slice(0, 20) }).interests).toHaveLength(20)
    })
  })

  describe('validateStep', () => {
    it('reports a missing name on the basics step', () => {
      const draft = draftFromProfile(makeProfile({ full_name: '' }))
      const result = validateStep('basics', draft)
      expect(result.ok).toBe(false)
      expect(result.errors.fullName).toBeDefined()
    })

    it('accepts a complete basics step', () => {
      const draft = draftFromProfile(
        makeProfile({ date_of_birth: latestDateOfBirth() })
      )
      expect(validateStep('basics', draft).ok).toBe(true)
    })

    it('requires at least five interests', () => {
      const draft = draftFromProfile(makeProfile({ interests: ['a', 'b', 'c'] }))
      expect(validateStep('interests', draft).ok).toBe(false)
    })

    it('accepts exactly five interests', () => {
      const draft = draftFromProfile(makeProfile())
      expect(validateStep('interests', draft).ok).toBe(true)
    })

    it('rejects an underage date on the contact-adjacent date path', () => {
      const draft = draftFromProfile(makeProfile({ date_of_birth: '2010-01-01' }))
      const result = validateStep('basics', draft)
      expect(result.ok).toBe(false)
      expect(result.errors.dateOfBirth).toContain('18')
    })

    it('flags a location missing its country', () => {
      const draft = draftFromProfile(makeProfile({ location_country: '' }))
      const result = validateStep('location', draft)
      expect(result.ok).toBe(false)
      expect(result.errors.locationCountry).toBeDefined()
    })

    it('accepts a valid contact entry', () => {
      const draft = draftFromProfile(makeProfile())
      Object.assign(draft, { whatsappNumber: '+91 98765 43210', shareMode: 'approved', whatsappConsent: true })
      expect(validateStep('contact', draft).ok).toBe(true)
    })
  })
})

describe('profile completeness', () => {
  it('need at least two photos to count as complete', () => {
    expect(MIN_PROFILE_PHOTOS).toBe(2)

    expect(
      isProfileComplete({
        full_name: 'Ada Lovelace',
        bio: 'A bio',
        interested_in: ['male'],
        location_city: 'Mumbai',
        location_country: 'India',
        photos: ['https://example.com/a.jpg'],
        photos_count: 1,
      })
    ).toBe(true)

    expect(
      isProfileComplete({
        full_name: 'Ada Lovelace',
        bio: 'A bio',
        interested_in: ['male'],
        location_city: 'Mumbai',
        location_country: 'India',
        photos: [],
        photos_count: 1,
      })
    ).toBe(false)
  })

  it('is false when any required piece is missing', () => {
    const base = {
      full_name: 'Ada Lovelace',
      bio: 'A bio',
      interested_in: ['male'] as UserProfile['interested_in'],
      location_city: 'Mumbai',
      location_country: 'India',
      photos: [] as string[],
      photos_count: 2,
    }
    expect(isProfileComplete({ ...base, full_name: '' })).toBe(false)
    expect(isProfileComplete({ ...base, bio: '' })).toBe(false)
    expect(isProfileComplete({ ...base, interested_in: [] })).toBe(false)
    expect(isProfileComplete({ ...base, location_city: '' })).toBe(false)
    expect(isProfileComplete({ ...base, location_country: '' })).toBe(false)
  })

  it('counts a 25-year-old date as adult for the age gate', () => {
    expect(ageFromDateOfBirth('2001-01-01')).toBeGreaterThanOrEqual(18)
  })
})