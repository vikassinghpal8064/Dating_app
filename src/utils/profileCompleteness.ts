import type { UserProfile } from '../types'

/** The minimum number of photos a complete profile must carry. */
export const MIN_PROFILE_PHOTOS = 2

/**
 * Whether a profile is complete enough to enter the app's discovery surfaces.
 *
 * Mirrors the checklist the onboarding wizard renders. A profile needs at
 * least two photos across both sources — pasted URLs (`photos`) and the
 * member's own uploads (`photos_count`, populated from `member_photos` by the
 * auth store) — so a finished wizard with two uploads is complete, and a
 * profile with two pasted URLs is too.
 */
export function isProfileComplete(
  profile: Pick<
    UserProfile,
    'bio' | 'full_name' | 'interested_in' | 'location_city' | 'location_country' | 'photos'
  > & { photos_count?: number }
): boolean {
  const photoTotal = (profile.photos?.length ?? 0) + (profile.photos_count ?? 0)
  return Boolean(
    profile.full_name?.trim() &&
      profile.bio?.trim() &&
      profile.location_city?.trim() &&
      profile.location_country?.trim() &&
      (profile.interested_in?.length ?? 0) > 0 &&
      photoTotal >= MIN_PROFILE_PHOTOS
  )
}

/**
 * Routes a member who still has onboarding work to do is allowed to visit
 * without being bounced back: the completion screens themselves.
 */
export const COMPLETION_ALLOWED_PATH = /^(\/onboarding|\/app\/me(?:\/edit)?|\/app\/settings|\/app\/profile\/)/