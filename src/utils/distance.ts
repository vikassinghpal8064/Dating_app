/**
 * Distance privacy.
 *
 * Exact coordinates and exact metre/kilometre precision would let a user work
 * out where somebody lives, so the UI only ever renders a coarse bucket. Keep
 * the bucket boundaries in one place so every surface agrees.
 */

export const DISTANCE_BUCKETS = [
  { id: 'near', maxKm: 1, label: 'Less than 1 km away' },
  { id: 'walking', maxKm: 5, label: '1 to 5 km away' },
  { id: 'city', maxKm: 10, label: '5 to 10 km away' },
  { id: 'region', maxKm: 25, label: '10 to 25 km away' },
  { id: 'wide', maxKm: 50, label: '25 to 50 km away' },
  { id: 'far', maxKm: 100, label: '50 to 100 km away' },
  { id: 'distant', maxKm: Number.POSITIVE_INFINITY, label: 'Over 100 km away' },
] as const

export type DistanceBucketId = (typeof DISTANCE_BUCKETS)[number]['id']

export const DISTANCE_HIDDEN_LABEL = 'Distance hidden'

export interface DistanceBucket {
  id: DistanceBucketId
  label: string
  /** Inclusive lower bound in km, used for sorting and filtering. */
  minKm: number
}

function resolve(km: number): DistanceBucket {
  let lowerBound = 0

  for (const bucket of DISTANCE_BUCKETS) {
    if (km < bucket.maxKm) {
      return { id: bucket.id, label: bucket.label, minKm: lowerBound }
    }
    lowerBound = bucket.maxKm
  }

  // Unreachable: the final bucket has an infinite `maxKm`.
  const last = DISTANCE_BUCKETS[DISTANCE_BUCKETS.length - 1]
  return { id: last.id, label: last.label, minKm: 0 }
}

/**
 * Maps a distance in kilometres onto a privacy-safe bucket. Returns `null` when
 * the distance is unknown or the user has hidden their location, so callers can
 * distinguish "hidden" from "close by".
 */
export function distanceBucket(km: number | null | undefined): DistanceBucket | null {
  if (km === null || km === undefined) return null
  if (Number.isNaN(km) || km < 0) return null
  return resolve(km)
}

/** Human-readable bucket label for display, never the raw kilometre value. */
export function formatDistance(km: number | null | undefined): string {
  const bucket = distanceBucket(km)
  return bucket ? bucket.label : DISTANCE_HIDDEN_LABEL
}
