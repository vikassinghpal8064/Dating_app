import { describe, expect, it } from 'vitest'
import {
  activeFilterCount,
  ANYWHERE_RADIUS_LABEL,
  bucketLabel,
  buildSearchParams,
  buildSearchRpcArgs,
  DISTANCE_HIDDEN_LABEL,
  INTEREST_OPTIONS,
  LOOKING_FOR_LABELS,
  parseSearchParams,
  RADIUS_OPTIONS,
  SEARCH_FILTERS_DEFAULT,
  toCityOption,
  toSearchProfile,
} from '@/utils/search'
import type { Database } from '@/types/database'
import type { SearchFilters } from '@/types'

type SearchRpcRow = Database['public']['Functions']['search_profiles']['Returns'][number]

describe('search URL query string <-> SearchFilters', () => {
  it('parses an empty query into the default filters', () => {
    expect(parseSearchParams('')).toEqual(SEARCH_FILTERS_DEFAULT)
    expect(parseSearchParams('radius=any')).toEqual(SEARCH_FILTERS_DEFAULT)
  })

  it('parses a fully-populated query', () => {
    const filters = parseSearchParams(
      'city=Bengaluru&radius=10&minAge=25&maxAge=40&gender=female' +
        '&lookingFor=serious,casual&verified=1&online=1&interests=cycling,reading' +
        '&minHeight=160&maxHeight=185'
    )
    expect(filters).toMatchObject({
      city: 'Bengaluru',
      radiusKm: 10,
      minAge: 25,
      maxAge: 40,
      gender: 'female',
      lookingFor: ['serious', 'casual'],
      verifiedOnly: true,
      onlineOnly: true,
      interests: ['cycling', 'reading'],
      minHeightCm: 160,
      maxHeightCm: 185,
    })
  })

  it('falls back to defaults for malformed values', () => {
    const filters = parseSearchParams(
      'radius=9000&gender=banana&minAge=abc&maxAge=5&verified=maybe&minHeight=short'
    )
    expect(filters.radiusKm).toBeNull()
    expect(filters.gender).toBe('everyone')
    // 5 clamps up to the 18 floor, and min/max collapse to a single point.
    expect(filters.minAge).toBe(18)
    expect(filters.maxAge).toBe(18)
    expect(filters.verifiedOnly).toBe(false)
    expect(filters.minHeightCm).toBeNull()
  })

  it('dedupes and caps list parameters', () => {
    const overlength = 'x'.repeat(40)
    const filters = parseSearchParams(
      `lookingFor=serious,serious,casual&interests=cycling,cycling,${overlength}`
    )
    expect(filters.lookingFor).toEqual(['serious', 'casual'])
    expect(filters.interests).toEqual(['cycling'])
  })

  it('round-trips every accepted value through build -> parse', () => {
    const query =
      'city=Bengaluru&radius=10&minAge=25&maxAge=40&gender=female&lookingFor=serious,casual' +
      '&verified=1&online=1&interests=cycling,reading&minHeight=160&maxHeight=185'
    const rebuilt = buildSearchParams(parseSearchParams(query))
    expect(new URLSearchParams(rebuilt).toString()).toBe(new URLSearchParams(query).toString())
    expect(parseSearchParams(buildSearchParams(parseSearchParams(query)))).toEqual(
      parseSearchParams(query)
    )
  })

  it('serialises defaults to an explicit radius=any and parses back to defaults', () => {
    // Radius is always explicit in the URL (the one key the UI always owns).
    expect(buildSearchParams(SEARCH_FILTERS_DEFAULT)).toBe('radius=any')
    expect(parseSearchParams(buildSearchParams(SEARCH_FILTERS_DEFAULT))).toEqual(
      SEARCH_FILTERS_DEFAULT
    )
  })

  it('writes radius=any explicitly for the "anywhere" filter', () => {
    const built = buildSearchParams({ ...SEARCH_FILTERS_DEFAULT, city: 'Mumbai' })
    expect(built).toContain('city=Mumbai')
    expect(built).toContain('radius=any')
    expect(parseSearchParams(built).radiusKm).toBeNull()
  })
})

describe('search vocabulary', () => {
  it('offers the five distance rings plus the anywhere label', () => {
    expect(RADIUS_OPTIONS.map((ring) => ring.value)).toEqual([5, 10, 25, 50, 100])
    expect(ANYWHERE_RADIUS_LABEL).toBe('Anywhere in city')
  })

  it('labels every looking-for value the schema stores', () => {
    expect(Object.keys(LOOKING_FOR_LABELS).sort()).toEqual(['casual', 'friends', 'serious', 'unsure'])
    expect(LOOKING_FOR_LABELS.serious).toBe('Serious relationship')
  })

  it('offers a non-empty interest vocabulary', () => {
    expect(INTEREST_OPTIONS.length).toBeGreaterThan(20)
    expect(INTEREST_OPTIONS).toContain('cycling')
    expect(INTEREST_OPTIONS).toContain('street food')
  })
})

describe('bucketLabel', () => {
  it('maps a known bucket id to the shared distance label', () => {
    expect(bucketLabel('near')).toBe('Less than 1 km away')
    expect(bucketLabel('city')).toBe('5 to 10 km away')
    expect(bucketLabel('far')).toBe('50 to 100 km away')
  })

  it('is hidden when the bucket is missing or unknown', () => {
    expect(bucketLabel(null)).toBe(DISTANCE_HIDDEN_LABEL)
    expect(bucketLabel(undefined)).toBe(DISTANCE_HIDDEN_LABEL)
    expect(bucketLabel('hyperspace' as never)).toBe(DISTANCE_HIDDEN_LABEL)
  })
})

describe('activeFilterCount', () => {
  it('is zero for the default filters', () => {
    expect(activeFilterCount(SEARCH_FILTERS_DEFAULT)).toBe(0)
  })

  it('counts each non-default filter exactly once', () => {
    const filters: SearchFilters = {
      city: 'Bengaluru',
      radiusKm: 10,
      minAge: 25,
      maxAge: 40,
      gender: 'female',
      lookingFor: ['serious'],
      verifiedOnly: true,
      onlineOnly: true,
      interests: ['cycling'],
      minHeightCm: 155,
      maxHeightCm: 190,
    }
    expect(activeFilterCount(filters)).toBe(11)
  })
})

describe('toSearchProfile', () => {
  it('fills safe defaults for the nullable RPC columns', () => {
    const profile = toSearchProfile({ id: 'abc' } as SearchRpcRow)
    expect(profile).toMatchObject({
      id: 'abc',
      full_name: '',
      age: 0,
      photos: [],
      is_online: false,
      distance_bucket: null,
      is_verified: false,
      looking_for: 'unsure',
      interests: [],
      height_cm: null,
      distance_km: null,
    })
  })

  it('keeps every field the search card renders', () => {
    const profile = toSearchProfile({
      id: 'abc',
      full_name: 'Riley R',
      age: 30,
      gender: 'female',
      interested_in: ['everyone'],
      bio: 'bio',
      photos: ['https://example.com/y.jpg'],
      location_city: 'Mumbai',
      location_country: 'India',
      distance_bucket: 'near',
      is_online: true,
      last_active: '2026-09-29T10:00:00Z',
      is_verified: true,
      looking_for: 'serious',
      interests: ['cycling', 'reading'],
      height_cm: 165,
    } as SearchRpcRow)
    expect(profile.full_name).toBe('Riley R')
    expect(profile.distance_bucket).toBe('near')
    expect(profile.looking_for).toBe('serious')
    expect(profile.interests).toEqual(['cycling', 'reading'])
    expect(profile.height_cm).toBe(165)
  })
})

describe('buildSearchRpcArgs', () => {
  it('sends only the age window and pagination by default', () => {
    expect(buildSearchRpcArgs(SEARCH_FILTERS_DEFAULT, null, 20, 0)).toEqual({
      min_age: 18,
      max_age: 99,
      limit_count: 20,
      offset_count: 0,
    })
  })

  it('prefers the named city over caller coordinates — the browser never sends them', () => {
    const center = { lat: 19.08, lng: 72.88 }
    const args = buildSearchRpcArgs({ ...SEARCH_FILTERS_DEFAULT, city: 'Bengaluru' }, center, 20, 0)
    expect(args.city_name).toBe('Bengaluru')
    expect(args.search_lat).toBeUndefined()
    expect(args.search_lng).toBeUndefined()
  })

  it('sends caller coordinates only when no city is set', () => {
    const center = { lat: 19.08, lng: 72.88 }
    const args = buildSearchRpcArgs(SEARCH_FILTERS_DEFAULT, center, 20, 0)
    expect(args.search_lat).toBe(19.08)
    expect(args.search_lng).toBe(72.88)
  })

  it('omits every centre key when neither city nor centre exists', () => {
    const args = buildSearchRpcArgs(SEARCH_FILTERS_DEFAULT, null, 20, 0)
    expect('city_name' in args).toBe(false)
    expect('search_lat' in args).toBe(false)
    expect('search_lng' in args).toBe(false)
  })

  it('maps radius, gender, looking-for, flags, interests and heights', () => {
    const args = buildSearchRpcArgs(
      {
        ...SEARCH_FILTERS_DEFAULT,
        radiusKm: 10,
        gender: 'female',
        lookingFor: ['serious', 'friends'],
        verifiedOnly: true,
        onlineOnly: true,
        interests: ['cycling'],
        minHeightCm: 155,
        maxHeightCm: 190,
      },
      { lat: 19.08, lng: 72.88 },
      20,
      0
    )
    expect(args.radius_km).toBe(10)
    expect(args.genders).toEqual(['female'])
    expect(args.looking_for_values).toEqual(['serious', 'friends'])
    expect(args.verified_only).toBe(true)
    expect(args.online_only).toBe(true)
    expect(args.interest_values).toEqual(['cycling'])
    expect(args.height_min_cm).toBe(155)
    expect(args.height_max_cm).toBe(190)
  })
})

describe('toCityOption', () => {
  it('maps a city_coordinates row onto the client shape', () => {
    const option = toCityOption({
      city: 'Bengaluru',
      country: 'India',
      latitude: 12.97,
      longitude: 77.59,
    })
    expect(option).toEqual({ city: 'Bengaluru', country: 'India', latitude: 12.97, longitude: 77.59 })
  })
})