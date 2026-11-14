import { z } from 'zod'
import { DISTANCE_BUCKETS, type DistanceBucketId } from './distance'
import type { Database } from '../types/database'
import type {
  CityOption,
  DistanceRadiusKm,
  LookingFor,
  SearchFilters,
  SearchGender,
  SearchProfile,
} from '../types'

type SearchRpcRow = Database['public']['Functions']['search_profiles']['Returns'][number]
export type SearchRpcArgs = Database['public']['Functions']['search_profiles']['Args']

/** A point to search "from". Either the caller's stored location or a city. */
export interface SearchCenter {
  lat: number
  lng: number
}

// ---------------------------------------------------------------------------
// Vocabulary the /search page shares with the URL query string
// ---------------------------------------------------------------------------

/** The distance rings the slider offers; `any` = "anywhere". */
export const RADIUS_OPTIONS: { value: DistanceRadiusKm; label: string }[] = [
  { value: 5, label: 'Within 5 km' },
  { value: 10, label: 'Within 10 km' },
  { value: 25, label: 'Within 25 km' },
  { value: 50, label: 'Within 50 km' },
  { value: 100, label: 'Within 100 km' },
]

export const ANYWHERE_RADIUS_LABEL = 'Anywhere in city'

export const LOOKING_FOR_LABELS: Record<LookingFor, string> = {
  serious: 'Serious relationship',
  casual: 'Something casual',
  friends: 'Friends first',
  unsure: 'Not sure yet',
}

/** Selectable interest tags, mirroring the values stored on profiles. */
export const INTEREST_OPTIONS = [
  'climbing',
  'cycling',
  'trekking',
  'running',
  'pottery',
  'reading',
  'street food',
  'cricket',
  'board games',
  'cooking',
  'scuba diving',
  'birdwatching',
  'kayaking',
  'books',
  'jazz',
  'architecture',
  'sketching',
  'live music',
  'chess',
  'synthesizers',
  'baking',
  'yoga',
  'podcasts',
  'hiking',
  'crossword',
  'vinyl',
  'street photography',
  'food',
  'photography',
  'bouldering',
  'surfskate',
  'salsa',
  'film',
  'history',
  'long drives',
  'gardening',
  'debate',
  'badminton',
  'trains',
  'swimming',
  'coffee',
  'travel',
] as const

/** Server-side bucket id → the human label the UI already agrees on. */
const BUCKET_LABELS = Object.fromEntries(
  DISTANCE_BUCKETS.map((bucket) => [bucket.id, bucket.label])
) as Record<DistanceBucketId, string>

export const DISTANCE_HIDDEN_LABEL = 'Distance hidden'

/** Human label for a server-computed bucket; hidden when there is none. */
export function bucketLabel(bucket: DistanceBucketId | null | undefined): string {
  if (bucket === null || bucket === undefined) return DISTANCE_HIDDEN_LABEL
  return BUCKET_LABELS[bucket] ?? DISTANCE_HIDDEN_LABEL
}

// ---------------------------------------------------------------------------
// URL query string <-> SearchFilters, validated both ways
// ---------------------------------------------------------------------------

export const SEARCH_FILTERS_DEFAULT: SearchFilters = {
  city: null,
  radiusKm: null,
  minAge: 18,
  maxAge: 99,
  gender: 'everyone',
  lookingFor: [],
  verifiedOnly: false,
  onlineOnly: false,
  interests: [],
  minHeightCm: null,
  maxHeightCm: null,
}

const radiusSchema = z.enum(['5', '10', '25', '50', '100', 'any'])
const genderSchema = z.enum(['everyone', 'male', 'female', 'non_binary'])
const lookingForSchema = z.enum(['casual', 'serious', 'friends', 'unsure'])

const MIN_AGE_FLOOR = 18
const MAX_AGE_CEILING = 99
const MIN_HEIGHT_FLOOR = 140
const MAX_HEIGHT_CEILING = 220
const MAX_INTEREST_LENGTH = 32

function parseBounded(raw: string | null, fallback: number, min: number, max: number): number {
  if (raw === null || raw === '') return fallback
  const n = Number(raw)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

function parseList(raw: string | null): string[] {
  if (!raw) return []
  return [...new Set(raw.split(',').map((part) => part.trim()).filter(Boolean))]
    .filter((part) => part.length <= MAX_INTEREST_LENGTH)
    .slice(0, 24)
}

/**
 * Turns a URL query string into validated filters. Anything malformed falls
 * back to its default rather than breaking the page, so a shared link with a
 * typo still renders.
 */
export function parseSearchParams(search: string): SearchFilters {
  const params = new URLSearchParams(search)

  const radiusResult = radiusSchema.safeParse(params.get('radius') ?? 'any')
  const radius = radiusResult.success
    ? radiusResult.data === 'any'
      ? null
      : (Number(radiusResult.data) as DistanceRadiusKm)
    : null

  const genderResult = genderSchema.safeParse(params.get('gender') ?? 'everyone')
  const gender: SearchGender = genderResult.success ? genderResult.data : 'everyone'

  const lookingFor = parseList(params.get('lookingFor')).filter((value): value is LookingFor =>
    lookingForSchema.safeParse(value).success
  ) as LookingFor[]

  const minAge = parseBounded(params.get('minAge'), 18, MIN_AGE_FLOOR, MAX_AGE_CEILING)
  const maxAge = parseBounded(params.get('maxAge'), 99, MIN_AGE_FLOOR, MAX_AGE_CEILING)

  const minHeight = parseBounded(params.get('minHeight'), -1, MIN_HEIGHT_FLOOR, MAX_HEIGHT_CEILING)
  const maxHeight = parseBounded(params.get('maxHeight'), -1, MIN_HEIGHT_FLOOR, MAX_HEIGHT_CEILING)

  const city = params.get('city')?.trim() ?? ''
  const interests = parseList(params.get('interests'))

  return {
    city: city.length > 0 ? city : null,
    radiusKm: radius,
    minAge: Math.min(minAge, maxAge),
    maxAge: Math.max(minAge, maxAge),
    gender,
    lookingFor,
    verifiedOnly: params.get('verified') === '1',
    onlineOnly: params.get('online') === '1',
    interests,
    minHeightCm: minHeight >= MIN_HEIGHT_FLOOR ? minHeight : null,
    maxHeightCm: maxHeight >= MIN_HEIGHT_FLOOR ? maxHeight : null,
  }
}

/** Serialises filters into a query string ('' when everything is default). */
export function buildSearchParams(filters: SearchFilters): string {
  const params = new URLSearchParams()
  if (filters.city) params.set('city', filters.city)
  params.set('radius', filters.radiusKm === null ? 'any' : String(filters.radiusKm))
  if (filters.minAge !== SEARCH_FILTERS_DEFAULT.minAge) params.set('minAge', String(filters.minAge))
  if (filters.maxAge !== SEARCH_FILTERS_DEFAULT.maxAge) params.set('maxAge', String(filters.maxAge))
  if (filters.gender !== 'everyone') params.set('gender', filters.gender)
  if (filters.lookingFor.length > 0) params.set('lookingFor', filters.lookingFor.join(','))
  if (filters.verifiedOnly) params.set('verified', '1')
  if (filters.onlineOnly) params.set('online', '1')
  if (filters.interests.length > 0) params.set('interests', filters.interests.join(','))
  if (filters.minHeightCm !== null) params.set('minHeight', String(filters.minHeightCm))
  if (filters.maxHeightCm !== null) params.set('maxHeight', String(filters.maxHeightCm))
  return params.toString()
}

/** How many filters differ from the defaults — drives the badge on the button. */
export function activeFilterCount(filters: SearchFilters): number {
  let count = 0
  if (filters.city) count += 1
  if (filters.radiusKm !== null) count += 1
  if (filters.minAge !== SEARCH_FILTERS_DEFAULT.minAge) count += 1
  if (filters.maxAge !== SEARCH_FILTERS_DEFAULT.maxAge) count += 1
  if (filters.gender !== 'everyone') count += 1
  if (filters.lookingFor.length > 0) count += 1
  if (filters.verifiedOnly) count += 1
  if (filters.onlineOnly) count += 1
  if (filters.interests.length > 0) count += 1
  if (filters.minHeightCm !== null) count += 1
  if (filters.maxHeightCm !== null) count += 1
  return count
}

// ---------------------------------------------------------------------------
// RPC row normaliser and argument builder
// ---------------------------------------------------------------------------

/** Closes the gap between the RPC's nullable columns and the card contract. */
export function toSearchProfile(row: SearchRpcRow): SearchProfile {
  const interests = Array.isArray(row.interests) ? row.interests : []
  const lookingFor = row.looking_for ?? 'unsure'

  return {
    id: row.id ?? '',
    full_name: row.full_name ?? '',
    age: row.age ?? 0,
    gender: row.gender ?? '',
    interested_in: row.interested_in ?? [],
    bio: row.bio ?? '',
    photos: row.photos ?? [],
    location_city: row.location_city ?? '',
    location_country: row.location_country ?? '',
    distance_km: null,
    is_online: row.is_online ?? false,
    last_active: row.last_active ?? '',
    distance_bucket: (row.distance_bucket as DistanceBucketId | null) ?? null,
    is_verified: row.is_verified ?? false,
    looking_for: (lookingFor as LookingFor) ?? 'unsure',
    interests,
    height_cm: row.height_cm ?? null,
  }
}

/**
 * Wraps the RPC results in the approved-photo merge, keeping the extra search
 * card fields the schema maps (the merge only replaces `.photos`).
 */
export function withApprovedPhotos(profiles: SearchProfile[]): Promise<SearchProfile[]> {
  return import('../utils/memberPhotoDisplay').then(({ mergeApprovedMemberPhotos }) =>
    mergeApprovedMemberPhotos(profiles).then((merged) => merged.map((p) => p as SearchProfile))
  )
}

/**
 * Builds the `search_profiles` RPC arguments for a page of results. Null values
 * are omitted entirely (the database treats them as "no filter"), which is
 * exactly what the generated types express.
 */
export function buildSearchRpcArgs(
  filters: SearchFilters,
  center: SearchCenter | null,
  limitCount: number,
  offsetCount: number
): SearchRpcArgs {
  const args: SearchRpcArgs = {
    min_age: filters.minAge,
    max_age: filters.maxAge,
    limit_count: limitCount,
    offset_count: offsetCount,
  }

  if (filters.city) {
    // The named city always wins the centre: the server resolves it to its
    // rounded gazetteer coordinates, so a shared ?city= link behaves the same
    // for every viewer without the browser sending anybody's coordinates.
    args.city_name = filters.city
  } else if (center) {
    args.search_lat = center.lat
    args.search_lng = center.lng
  } else {
    // No city and no centre: the server falls back to the caller's stored
    // location, which is the same privacy boundary as the rest of the schema.
  }

  if (filters.radiusKm !== null) args.radius_km = filters.radiusKm
  if (filters.gender !== 'everyone') args.genders = [filters.gender]
  if (filters.lookingFor.length > 0) args.looking_for_values = filters.lookingFor
  if (filters.verifiedOnly) args.verified_only = true
  if (filters.onlineOnly) args.online_only = true
  if (filters.interests.length > 0) args.interest_values = filters.interests
  if (filters.minHeightCm !== null) args.height_min_cm = filters.minHeightCm
  if (filters.maxHeightCm !== null) args.height_max_cm = filters.maxHeightCm

  return args
}

/** One city_coordinates row in the client's shape. */
export function toCityOption(row: Database['public']['Tables']['city_coordinates']['Row']): CityOption {
  return {
    city: row.city,
    country: row.country,
    latitude: row.latitude,
    longitude: row.longitude,
  }
}