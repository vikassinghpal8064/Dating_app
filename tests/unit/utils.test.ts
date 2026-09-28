import { describe, it, expect } from 'vitest'
import {
  DISTANCE_BUCKETS,
  distanceBucket,
  formatDistance,
  calculateAge,
  formatRelativeTime,
  truncate,
  isValidEmail,
  isValidPhoneNumber,
  sanitizeInput,
  debounce,
  throttle
} from '@/utils'

describe('Utility Functions', () => {
  describe('formatDistance', () => {
    it('returns "Distance hidden" for null', () => {
      expect(formatDistance(null)).toBe('Distance hidden')
    })

    it('returns "Distance hidden" for undefined', () => {
      expect(formatDistance(undefined)).toBe('Distance hidden')
    })

    it('returns "Distance hidden" for a negative distance', () => {
      expect(formatDistance(-3)).toBe('Distance hidden')
    })

    it('buckets distances under 1km', () => {
      expect(formatDistance(0.5)).toBe('Less than 1 km away')
      expect(formatDistance(0)).toBe('Less than 1 km away')
    })

    it('buckets the 1-5km range without leaking exact precision', () => {
      expect(formatDistance(1)).toBe('1 to 5 km away')
      expect(formatDistance(4.999)).toBe('1 to 5 km away')
    })

    it('buckets the 5-10km range', () => {
      expect(formatDistance(5)).toBe('5 to 10 km away')
      expect(formatDistance(5.5)).toBe('5 to 10 km away')
      expect(formatDistance(9.99)).toBe('5 to 10 km away')
    })

    it('buckets the 10-25km range', () => {
      expect(formatDistance(10)).toBe('10 to 25 km away')
      expect(formatDistance(15.7)).toBe('10 to 25 km away')
      expect(formatDistance(24.9)).toBe('10 to 25 km away')
    })

    it('buckets the 25-50km range', () => {
      expect(formatDistance(25)).toBe('25 to 50 km away')
      expect(formatDistance(49.9)).toBe('25 to 50 km away')
    })

    it('buckets the 50-100km range', () => {
      expect(formatDistance(50)).toBe('50 to 100 km away')
      expect(formatDistance(99.9)).toBe('50 to 100 km away')
    })

    it('buckets anything beyond 100km', () => {
      expect(formatDistance(100)).toBe('Over 100 km away')
      expect(formatDistance(2500)).toBe('Over 100 km away')
    })

    it('never renders a raw kilometre figure', () => {
      const validLabels = new Set<string>(DISTANCE_BUCKETS.map((bucket) => bucket.label))

      for (const km of [0, 0.4, 1, 2.5, 5, 7.77, 10, 23.4, 25, 60, 100, 999]) {
        const label = formatDistance(km)

        // The label must be one of the sanctioned buckets.
        expect(validLabels.has(label)).toBe(true)

        // No decimals, and no bare "<n> km" / "n km away" precision.
        expect(label).not.toMatch(/\d+\.\d+/)
        expect(label).not.toMatch(/^<?\d+(\.\d+)?\s*km\b/)
        expect(label).not.toMatch(/^\d+(\.\d+)?\s*km\s+away$/)
      }
    })

    it('maps the same bucket to the same label for every value inside it', () => {
      expect(formatDistance(6)).toBe(formatDistance(9.9))
      expect(formatDistance(11)).toBe(formatDistance(24))
    })
  })

  describe('distanceBucket', () => {
    it('returns null when the distance is unknown', () => {
      expect(distanceBucket(null)).toBeNull()
      expect(distanceBucket(undefined)).toBeNull()
      expect(distanceBucket(Number.NaN)).toBeNull()
    })

    it('returns null for a negative distance', () => {
      expect(distanceBucket(-0.1)).toBeNull()
    })

    it('exposes an id and an inclusive lower bound for every bucket', () => {
      expect(distanceBucket(0.5)).toEqual({ id: 'near', label: 'Less than 1 km away', minKm: 0 })
      expect(distanceBucket(3)).toEqual({ id: 'walking', label: '1 to 5 km away', minKm: 1 })
      expect(distanceBucket(7)).toEqual({ id: 'city', label: '5 to 10 km away', minKm: 5 })
      expect(distanceBucket(12)).toEqual({ id: 'region', label: '10 to 25 km away', minKm: 10 })
      expect(distanceBucket(30)).toEqual({ id: 'wide', label: '25 to 50 km away', minKm: 25 })
      expect(distanceBucket(60)).toEqual({ id: 'far', label: '50 to 100 km away', minKm: 50 })
      expect(distanceBucket(400)).toEqual({
        id: 'distant',
        label: 'Over 100 km away',
        minKm: 100,
      })
    })

    it('keeps bucket ids unique and ordered by distance', () => {
      const ids = DISTANCE_BUCKETS.map((b) => b.id)
      expect(new Set(ids).size).toBe(ids.length)

      const lowerBounds = [0, ...DISTANCE_BUCKETS.map((b) => b.maxKm).slice(0, -1)]
      for (let i = 1; i < lowerBounds.length; i += 1) {
        expect(lowerBounds[i]).toBeGreaterThan(lowerBounds[i - 1])
      }
    })
  })

  describe('calculateAge', () => {
    it('calculates correct age for birthday this year', () => {
      const today = new Date()
      const birthYear = today.getFullYear() - 25
      const dob = `${birthYear}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      expect(calculateAge(dob)).toBe(25)
    })

    it('calculates correct age for birthday not yet this year', () => {
      const today = new Date()
      const birthYear = today.getFullYear() - 25
      const nextMonth = (today.getMonth() + 2) % 12 || 12
      const dob = `${birthYear}-${String(nextMonth).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      expect(calculateAge(dob)).toBe(24)
    })

    it('returns correct age for leap year birthday', () => {
      expect(calculateAge('2000-02-29')).toBe(new Date().getFullYear() - 2000)
    })
  })

  describe('formatRelativeTime', () => {
    it('returns "Just now" for very recent times', () => {
      const now = new Date().toISOString()
      expect(formatRelativeTime(now)).toBe('Just now')
    })

    it('returns minutes for times under an hour', () => {
      const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      expect(formatRelativeTime(fiveMinsAgo)).toBe('5m ago')
    })

    it('returns hours for times under a day', () => {
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
      expect(formatRelativeTime(threeHoursAgo)).toBe('3h ago')
    })

    it('returns days for times under a week', () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      expect(formatRelativeTime(twoDaysAgo)).toBe('2d ago')
    })

    it('returns formatted date for times over a week', () => {
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
      const result = formatRelativeTime(tenDaysAgo)
      expect(result).toMatch(/\w{3} \d{1,2}, \d{4}/)
    })
  })

  describe('truncate', () => {
    it('returns original string if shorter than length', () => {
      expect(truncate('Hello', 10)).toBe('Hello')
    })

    it('truncates and adds ellipsis', () => {
      expect(truncate('Hello World', 8)).toBe('Hello Wo...')
    })

    it('handles exact length', () => {
      expect(truncate('Hello', 5)).toBe('Hello')
    })
  })

  describe('isValidEmail', () => {
    it('returns true for valid emails', () => {
      expect(isValidEmail('test@example.com')).toBe(true)
      expect(isValidEmail('user.name@domain.org')).toBe(true)
      expect(isValidEmail('user+tag@example.co.uk')).toBe(true)
    })

    it('returns false for invalid emails', () => {
      expect(isValidEmail('invalid')).toBe(false)
      expect(isValidEmail('@example.com')).toBe(false)
      expect(isValidEmail('test@')).toBe(false)
      expect(isValidEmail('test example.com')).toBe(false)
    })
  })

  describe('isValidPhoneNumber', () => {
    it('returns true for valid E.164 numbers', () => {
      expect(isValidPhoneNumber('+15551234567')).toBe(true)
      expect(isValidPhoneNumber('+919876543210')).toBe(true)
      expect(isValidPhoneNumber('+442071234567')).toBe(true)
    })

    it('handles spaces', () => {
      expect(isValidPhoneNumber('+1 555 123 4567')).toBe(true)
    })

    it('returns false for invalid numbers', () => {
      expect(isValidPhoneNumber('abc')).toBe(false)
      expect(isValidPhoneNumber('')).toBe(false)
    })
  })

  describe('sanitizeInput', () => {
    it('trims whitespace', () => {
      expect(sanitizeInput('  hello  ')).toBe('hello')
    })

    it('removes angle brackets', () => {
      expect(sanitizeInput('<script>alert(1)</script>')).toBe('scriptalert(1)/script')
    })

    it('handles combined cases', () => {
      expect(sanitizeInput('  <hello>  ')).toBe('hello')
    })
  })

  describe('debounce', () => {
    it('delays function execution', async () => {
      let callCount = 0
      const debouncedFn = debounce(() => { callCount++ }, 50)
      
      debouncedFn()
      debouncedFn()
      debouncedFn()
      
      expect(callCount).toBe(0)
      
      await new Promise(resolve => setTimeout(resolve, 100))
      expect(callCount).toBe(1)
    })
  })

  describe('throttle', () => {
    it('limits function execution rate', async () => {
      let callCount = 0
      const throttledFn = throttle(() => { callCount++ }, 50)
      
      throttledFn()
      throttledFn()
      throttledFn()
      
      expect(callCount).toBe(1)
      
      await new Promise(resolve => setTimeout(resolve, 100))
      throttledFn()
      expect(callCount).toBe(2)
    })
  })
})