import { describe, expect, it } from 'vitest'
import { formatLastActive, lifestyleLabel, toProfileDetail } from '@/utils/profileDetail'
import type { GetProfileRow } from '@/utils/profileDetail'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

function isoAgo(ms: number): string {
  return new Date(Date.now() - ms).toISOString()
}

describe('formatLastActive', () => {
  it('uses coarse bands and never exposes a precise timestamp', () => {
    expect(formatLastActive(isoAgo(10_000))).toBe('Active just now')
    expect(formatLastActive(isoAgo(30 * MINUTE))).toBe('Active today')
    expect(formatLastActive(isoAgo(6 * HOUR))).toBe('Active today')
    expect(formatLastActive(isoAgo(30 * HOUR))).toBe('Active yesterday')
    expect(formatLastActive(isoAgo(3 * DAY))).toBe('Active 3 days ago')
    expect(formatLastActive(isoAgo(10 * DAY))).toBe('Active this week')
    expect(formatLastActive(isoAgo(21 * DAY))).toBe('Active 3 weeks ago')
    expect(formatLastActive(isoAgo(200 * DAY))).toBe('Active 6 months ago')
    expect(formatLastActive(isoAgo(400 * DAY))).toBe('Active over a year ago')
  })

  it('falls back gracefully on malformed input', () => {
    expect(formatLastActive('not-a-date')).toBe('Active recently')
  })
})

describe('lifestyleLabel', () => {
  it('maps the known enum values to friendly copy', () => {
    expect(lifestyleLabel('smoking', 'never')).toBe('Never smokes')
    expect(lifestyleLabel('drinking', 'socially')).toBe('Drinks socially')
    expect(lifestyleLabel('exercise', 'daily')).toBe('Daily mover')
  })

  it('returns null for unknown or absent values so the chip is hidden', () => {
    expect(lifestyleLabel('smoking', null)).toBeNull()
    expect(lifestyleLabel('smoking', 'not_an_option')).toBeNull()
    expect(lifestyleLabel('exercise', '')).toBeNull()
  })
})

describe('toProfileDetail', () => {
  it('carries every column through and normalises nullables', () => {
    const row = {
      id: '20000000-0000-4000-8000-000000000001',
      full_name: 'Aarav Mehta',
      age: 27,
      gender: 'male',
      interested_in: ['female'],
      bio: 'Coffee first.',
      photos: ['https://example.com/a.jpg'],
      location_city: 'Mumbai',
      location_country: 'India',
      distance_bucket: 'near',
      is_online: true,
      last_active: '2026-09-29T10:00:00Z',
      is_verified: true,
      looking_for: 'serious',
      interests: ['reading', 'music'],
      height_cm: 178,
      education: 'IIT',
      occupation: 'Engineer',
      languages: ['English', 'Hindi'],
      smoking: 'never',
      drinking: 'socially',
      exercise: 'often',
      is_match: false,
      match_id: null,
      viewer_liked_type: null,
      liked_viewer: true,
      contact_can_request: false,
    } satisfies GetProfileRow

    const detail = toProfileDetail(row)
    expect(detail.id).toBe(row.id)
    expect(detail.full_name).toBe('Aarav Mehta')
    expect(detail.age).toBe(27)
    expect(detail.distance_bucket).toBe('near')
    expect(detail.is_verified).toBe(true)
    expect(detail.looking_for).toBe('serious')
    expect(detail.languages).toEqual(['English', 'Hindi'])
    expect(detail.is_match).toBe(false)
    expect(detail.match_id).toBeNull()
    expect(detail.viewer_liked_type).toBeNull()
    expect(detail.liked_viewer).toBe(true)
    // A matches-mode owner is not askable by strangers.
    expect(detail.contact_can_request).toBe(false)
    // PublicProfile superset: the client never renders raw kilometres.
    expect(detail.distance_km).toBeNull()
  })

  it('normalises hidden surfaces and nullable lifestyle fields to stable values', () => {
    const row = {
      id: '20000000-0000-4000-8000-000000000002',
      full_name: 'Diya Kapoor',
      age: null,
      gender: 'female',
      interested_in: ['male'],
      bio: null,
      photos: [],
      location_city: 'Mumbai',
      location_country: 'India',
      distance_bucket: null,
      is_online: false,
      last_active: '2026-09-29T10:00:00Z',
      is_verified: false,
      looking_for: null,
      interests: [],
      height_cm: null,
      education: null,
      occupation: null,
      languages: [],
      smoking: null,
      drinking: null,
      exercise: null,
      is_match: true,
      match_id: '10000000-0000-4000-8000-000000000001',
      viewer_liked_type: 'like',
      liked_viewer: false,
      contact_can_request: true,
    } satisfies GetProfileRow

    const detail = toProfileDetail(row)
    expect(detail.age).toBe(0)
    expect(detail.bio).toBe('')
    expect(detail.distance_bucket).toBeNull()
    expect(detail.looking_for).toBeNull()
    expect(detail.smoking).toBeNull()
    expect(detail.is_match).toBe(true)
    expect(detail.match_id).toBe('10000000-0000-4000-8000-000000000001')
    expect(detail.viewer_liked_type).toBe('like')
    // An 'approved'-mode owner invites the request affordance.
    expect(detail.contact_can_request).toBe(true)
  })
})