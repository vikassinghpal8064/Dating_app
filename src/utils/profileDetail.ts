import type { DistanceBucketId } from './distance'
import type { LookingFor, ProfileDetail, PublicProfile, SearchProfile } from '../types'
import type { Database } from '../types/database'

/** One row of the `get_profile` RPC — the /profile/:id door. */
export type GetProfileRow = Database['public']['Functions']['get_profile']['Returns'][number]

const SMOKING_LABELS: Record<string, string> = {
  never: 'Never smokes',
  occasionally: 'Smokes occasionally',
  regularly: 'Smokes regularly',
  quitting: 'Quitting smoking',
}

const DRINKING_LABELS: Record<string, string> = {
  never: 'Never drinks',
  socially: 'Drinks socially',
  regularly: 'Drinks regularly',
  quitting: 'Quitting drinking',
}

const EXERCISE_LABELS: Record<string, string> = {
  never: 'Seldom exercises',
  sometimes: 'Exercises sometimes',
  often: 'Exercises often',
  daily: 'Daily mover',
}

/** Human label for a lifestyle field the member chose; `null` hides the chip. */
export function lifestyleLabel(
  kind: 'smoking' | 'drinking' | 'exercise',
  value: string | null
): string | null {
  if (!value) return null
  const table = kind === 'smoking' ? SMOKING_LABELS : kind === 'drinking' ? DRINKING_LABELS : EXERCISE_LABELS
  return table[value] ?? null
}

/**
 * Coarse, deliberately approximate last-active wording. Exact timestamps would
 * let one member reconstruct another's habits, so the UI only ever speaks in
 * coarse bands, paralleling the distance buckets.
 */
export function formatLastActive(lastActive: string): string {
  const now = Date.now()
  const then = new Date(lastActive).getTime()
  if (Number.isNaN(then)) return 'Active recently'
  const elapsed = Math.max(0, now - then)
  const minutes = Math.floor(elapsed / 60000)
  const hours = Math.floor(elapsed / 3600000)
  const days = Math.floor(elapsed / 86400000)

  if (minutes < 1) return 'Active just now'
  if (hours < 24) return 'Active today'
  if (days < 2) return 'Active yesterday'
  if (days < 7) return `Active ${days} days ago`
  if (days < 14) return 'Active this week'
  if (days < 30) return `Active ${Math.floor(days / 7)} weeks ago`
  if (days < 365) return `Active ${Math.floor(days / 30)} months ago`
  return 'Active over a year ago'
}

/** Maps a `get_profile` row to the shape the /profile/:id page renders. */
export function toProfileDetail(row: GetProfileRow): ProfileDetail {
  return {
    id: row.id,
    full_name: row.full_name,
    age: row.age ?? 0,
    gender: row.gender,
    interested_in: row.interested_in,
    bio: row.bio ?? '',
    photos: row.photos,
    location_city: row.location_city,
    location_country: row.location_country,
    distance_km: null,
    is_online: row.is_online,
    last_active: row.last_active,
    distance_bucket: row.distance_bucket as DistanceBucketId | null,
    is_verified: row.is_verified,
    looking_for: (row.looking_for as LookingFor | null) ?? null,
    interests: row.interests,
    height_cm: row.height_cm,
    education: row.education,
    occupation: row.occupation,
    languages: row.languages,
    smoking: row.smoking,
    drinking: row.drinking,
    exercise: row.exercise,
    is_match: row.is_match,
    match_id: row.match_id,
    viewer_liked_type: row.viewer_liked_type as 'like' | 'super_like' | null,
    liked_viewer: row.liked_viewer,
    contact_can_request: row.contact_can_request,
  }
}

/** Adapter so the shared match/report surfaces can consume a profile page. */
export function toSearchProfileFromDetail(detail: ProfileDetail): SearchProfile {
  return {
    id: detail.id,
    full_name: detail.full_name,
    age: detail.age,
    gender: detail.gender,
    interested_in: detail.interested_in,
    bio: detail.bio,
    photos: detail.photos,
    location_city: detail.location_city,
    location_country: detail.location_country,
    is_online: detail.is_online,
    last_active: detail.last_active,
    distance_bucket: detail.distance_bucket,
    is_verified: detail.is_verified,
    looking_for: detail.looking_for ?? 'unsure',
    interests: detail.interests,
    height_cm: detail.height_cm,
  }
}

/** The minimal `PublicProfile` view two shared hooks both need. */
export type ProfileCardSource = PublicProfile