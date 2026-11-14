import type { PublicProfile } from '../types'
import type { Database } from '../types/database'

/**
 * The browser-facing shape of one discoverable member.
 *
 * `public_profiles` is a view over nullable profile columns; Postgres reports
 * every column of the view as `is_nullable = yes` even where the view itself
 * applies `coalesce`/`case` so the result can never be null
 * (migration 12). The generated types therefore use `T | null` for fields
 * that are always present at runtime. This normaliser is where that gap is
 * closed, once, with explicit defaults that mirror the view's guarantees:
 * `full_name`, `location_city` and `location_country` are coalesced to '',
 * `age` is 0 for an absent or malformed birth date, and `is_online` is false
 * unless the view explicitly says otherwise.
 */
export function toPublicProfile(row: Database['public']['Views']['public_profiles']['Row']): PublicProfile {
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
    distance_km: row.distance_km,
    is_online: row.is_online ?? false,
    last_active: row.last_active ?? '',
  }
}