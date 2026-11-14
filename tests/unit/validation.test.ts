import { describe, it, expect } from 'vitest'
import {
  MAX_PHOTOS,
  MINIMUM_AGE,
  PASSWORD_REQUIREMENTS,
  UNDERAGE_MESSAGE,
  ageFromDateOfBirth,
  dateOfBirthSchema,
  latestDateOfBirth,
  messageSchema,
  passwordSchema,
  passwordStrength,
  photoUrlSchema,
  preferencesSchema,
  profileSchema,
  signInSchema,
  signUpSchema,
  whatsappRequestSchema,
} from '@/utils/validation'

/** A date of birth that is definitely 18+ on any run date. */
const ADULT_DOB = '1990-01-01'

const validSignUp = {
  email: 'someone@example.com',
  password: 'Valid1!pass',
  confirmPassword: 'Valid1!pass',
  fullName: 'Test Person',
  dateOfBirth: ADULT_DOB,
  gender: 'female' as const,
  interestedIn: ['everyone' as const],
  locationCity: 'Leeds',
  locationCountry: 'United Kingdom',
  termsAccepted: true,
  ageConfirmed: true,
}

const validProfile = {
  fullName: 'Test Person',
  bio: 'Coffee, hills and bad weather.',
  locationCity: 'Leeds',
  locationCountry: 'United Kingdom',
  showDistance: true,
  interestedIn: ['everyone' as const],
  photos: [] as string[],
}

describe('Password policy', () => {
  it('is enforced by the same list the sign-up checklist renders', () => {
    // If the UI checklist and the schema ever disagree, a user can be shown a
    // password as valid that the server will reject.
    const samples = [
      '',
      'short1!',
      'alllowercase1!',
      'ALLUPPERCASE1!',
      'NoDigits!!',
      'NoSpecial1pass',
      'Valid1!pass',
    ]

    for (const sample of samples) {
      const schemaAccepts = passwordSchema.safeParse(sample).success
      const checklistAccepts = PASSWORD_REQUIREMENTS.every((rule) => rule.test(sample))
      expect(schemaAccepts, `"${sample}"`).toBe(checklistAccepts)
    }
  })

  it('describes each requirement in words the user can act on', () => {
    expect(PASSWORD_REQUIREMENTS.length).toBeGreaterThan(0)
    for (const rule of PASSWORD_REQUIREMENTS) {
      expect(rule.id).toBeTruthy()
      expect(rule.label).toBeTruthy()
      expect(typeof rule.test).toBe('function')
    }
  })

  it('enforces the 10-character floor stated in the checklist', () => {
    // 8 characters satisfies the old policy and must now fail.
    expect(passwordSchema.safeParse('Short8!x').success).toBe(false)
    // Exactly 10 characters, all classes present: the new floor, accepted.
    expect(passwordSchema.safeParse('Exactly10!x').success).toBe(true)
    expect(PASSWORD_REQUIREMENTS[0]?.label).toBe('At least 10 characters')
  })

  it('rates strength from the floor upward, not just pass/fail', () => {
    expect(passwordStrength('')).toBe('empty')
    expect(passwordStrength('short')).toBe('weak')
    expect(passwordStrength('Valid1!pass')).toBe('good')
    expect(passwordStrength('Valid1!pass-Longer')).toBe('strong')
  })
})

describe('18+ enforcement', () => {
  it('is 18, not 16 or 21', () => {
    expect(MINIMUM_AGE).toBe(18)
  })

  it('computes an age from a date of birth', () => {
    expect(ageFromDateOfBirth('2000-06-15', new Date('2026-06-14'))).toBe(25)
    expect(ageFromDateOfBirth('2000-06-15', new Date('2026-06-15'))).toBe(26)
  })

  it('returns NaN for an unparseable date rather than a misleading number', () => {
    expect(ageFromDateOfBirth('not-a-date')).toBeNaN()
  })

  it('offers a latest date of birth exactly MINIMUM_AGE years back', () => {
    const today = new Date('2026-03-10T12:00:00Z')
    expect(latestDateOfBirth(today)).toBe('2008-03-10')
  })

  it('rejects anyone under 18', () => {
    const result = dateOfBirthSchema.safeParse('2015-06-01')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(UNDERAGE_MESSAGE)
    }
  })

  it('accepts someone who turns 18 today', () => {
    const today = new Date()
    const cutoff = new Date(today)
    cutoff.setFullYear(cutoff.getFullYear() - 18)
    expect(dateOfBirthSchema.safeParse(cutoff.toISOString().slice(0, 10)).success).toBe(true)
  })

  it('rejects a missing or malformed date', () => {
    expect(dateOfBirthSchema.safeParse('').success).toBe(false)
    expect(dateOfBirthSchema.safeParse('31/12/1990').success).toBe(false)
  })
})

describe('signUpSchema', () => {
  it('accepts a complete adult sign-up', () => {
    expect(signUpSchema.safeParse(validSignUp).success).toBe(true)
  })

  it('rejects mismatched passwords', () => {
    const result = signUpSchema.safeParse({ ...validSignUp, confirmPassword: 'Different1!pass' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === 'Passwords do not match')).toBe(true)
    }
  })

  it('requires the terms to be accepted, not merely truthy', () => {
    expect(signUpSchema.safeParse({ ...validSignUp, termsAccepted: false }).success).toBe(false)
    expect(signUpSchema.safeParse({ ...validSignUp, termsAccepted: undefined }).success).toBe(false)
  })

  it('requires an explicit declaration that the member is 18 or older', () => {
    expect(signUpSchema.safeParse({ ...validSignUp, ageConfirmed: false }).success).toBe(false)
    expect(signUpSchema.safeParse({ ...validSignUp, ageConfirmed: undefined }).success).toBe(false)
  })

  it('treats the age confirmation and the terms as separate agreements', () => {
    // Tricking one checkbox must not satisfy the other.
    const termsOnly = signUpSchema.safeParse({ ...validSignUp, termsAccepted: true, ageConfirmed: false })
    const ageOnly = signUpSchema.safeParse({ ...validSignUp, termsAccepted: false, ageConfirmed: true })
    expect(termsOnly.success).toBe(false)
    expect(ageOnly.success).toBe(false)
  })

  it('requires at least one interest', () => {
    expect(signUpSchema.safeParse({ ...validSignUp, interestedIn: [] }).success).toBe(false)
  })

  it('rejects an unknown interest value', () => {
    expect(
      signUpSchema.safeParse({ ...validSignUp, interestedIn: ['aliens'] }).success
    ).toBe(false)
  })

  it('carries the under-18 message through to the form', () => {
    const result = signUpSchema.safeParse({ ...validSignUp, dateOfBirth: '2012-01-01' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === UNDERAGE_MESSAGE)).toBe(true)
    }
  })
})

describe('signInSchema', () => {
  it('accepts a well-formed pair', () => {
    expect(signInSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true)
  })

  it('rejects a malformed email and an empty password', () => {
    expect(signInSchema.safeParse({ email: 'nope', password: 'x' }).success).toBe(false)
    expect(signInSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false)
  })
})

describe('profileSchema', () => {
  it('accepts a valid profile', () => {
    expect(profileSchema.safeParse(validProfile).success).toBe(true)
  })

  it('requires a name of at least 2 characters', () => {
    expect(profileSchema.safeParse({ ...validProfile, fullName: 'A' }).success).toBe(false)
  })

  it('caps the bio at 500 characters', () => {
    expect(profileSchema.safeParse({ ...validProfile, bio: 'x'.repeat(500) }).success).toBe(true)
    expect(profileSchema.safeParse({ ...validProfile, bio: 'x'.repeat(501) }).success).toBe(false)
  })

  it('reports the failing photo index so the message lands on the right field', () => {
    const result = profileSchema.safeParse({
      ...validProfile,
      photos: ['https://cdn.example.com/ok.jpg', 'not-a-url'],
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.path[0]).toBe('photos')
      expect(result.error.issues[0]?.path[1]).toBe(1)
    }
  })
})

describe('photoUrlSchema', () => {
  it('accepts an https image URL', () => {
    expect(photoUrlSchema.safeParse('https://cdn.example.com/photo.webp').success).toBe(true)
  })

  it('rejects a plain http URL', () => {
    // http would be mixed content on the https origin, so it is refused.
    const result = photoUrlSchema.safeParse('http://cdn.example.com/photo.jpg')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Photos must be served over https')
    }
  })

  it('rejects a non-URL', () => {
    expect(photoUrlSchema.safeParse('my-photo.jpg').success).toBe(false)
    expect(photoUrlSchema.safeParse('').success).toBe(false)
  })

  it('rejects an absurdly long URL', () => {
    expect(photoUrlSchema.safeParse(`https://e.com/${'a'.repeat(3000)}`).success).toBe(false)
  })

  it('caps a profile at MAX_PHOTOS photos', () => {
    const photo = 'https://cdn.example.com/p.jpg'
    const build = (count: number) => Array.from({ length: count }, () => photo)

    expect(MAX_PHOTOS).toBe(6)
    expect(profileSchema.safeParse({ ...validProfile, photos: build(MAX_PHOTOS) }).success).toBe(true)
    expect(profileSchema.safeParse({ ...validProfile, photos: build(MAX_PHOTOS + 1) }).success).toBe(
      false
    )
  })
})

describe('preferencesSchema', () => {
  const base = {
    minAge: 25,
    maxAge: 40,
    maxDistanceKm: 50,
    showMeTo: 'everyone' as const,
    notifications: {
      newMatch: true,
      newMessage: true,
      whatsappRequest: true,
      profileLiked: true,
    },
    privacy: {
      showDistance: true,
      showOnlineStatus: true,
      showLastActive: true,
    },
  }

  it('accepts a sane set of preferences', () => {
    expect(preferencesSchema.safeParse(base).success).toBe(true)
  })

  it('never allows a minimum age below 18', () => {
    expect(preferencesSchema.safeParse({ ...base, minAge: 17 }).success).toBe(false)
    expect(preferencesSchema.safeParse({ ...base, maxAge: 17 }).success).toBe(false)
  })

  it('rejects a minimum age above the maximum', () => {
    const result = preferencesSchema.safeParse({ ...base, minAge: 50, maxAge: 30 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(
        result.error.issues.some(
          (i) => i.message === 'Minimum age cannot be greater than maximum age'
        )
      ).toBe(true)
    }
  })

  it('caps the maximum distance at 500 km', () => {
    expect(preferencesSchema.safeParse({ ...base, maxDistanceKm: 500 }).success).toBe(true)
    expect(preferencesSchema.safeParse({ ...base, maxDistanceKm: 5000 }).success).toBe(false)
  })
})

describe('messageSchema', () => {
  it('rejects an empty message', () => {
    expect(messageSchema.safeParse({ content: '' }).success).toBe(false)
  })

  it('rejects a message over 2000 characters', () => {
    expect(messageSchema.safeParse({ content: 'x'.repeat(2000) }).success).toBe(true)
    expect(messageSchema.safeParse({ content: 'x'.repeat(2001) }).success).toBe(false)
  })
})

describe('whatsappRequestSchema', () => {
  it('accepts an E.164 number', () => {
    expect(whatsappRequestSchema.safeParse({ whatsappNumber: '+15551234567' }).success).toBe(true)
  })

  it('rejects anything that is not a full international number', () => {
    expect(whatsappRequestSchema.safeParse({ whatsappNumber: '5551234' }).success).toBe(false)
    expect(whatsappRequestSchema.safeParse({ whatsappNumber: 'call me' }).success).toBe(false)
  })
})
