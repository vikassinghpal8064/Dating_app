import { supabase } from '../lib/supabase'
import type { PublicProfile } from '../types'

/**
 * Resolving a member's approved uploads into renderable URLs.
 *
 * `public_profiles.photos` only ever holds pasted https URLs. The uploads live
 * in `member_photos` (RLS: own / approved-and-visible) and the files themselves
 * sit in the private `profile-photos` bucket, so before any of them can be
 * rendered they must be (a) found in `member_photos` and (b) turned into
 * short-lived signed URLs. Both steps are batched per profile set, and the
 * signed URLs are cached for *less* than their own lifetime so the cache never
 * serves an expired link.
 */

/** How long the object API is asked to keep the signature valid, in seconds. */
const SIGNED_URL_TTL_SECONDS = 3600

/** We expire cache entries a minute early: a cached URL must never be dead. */
const CACHE_TTL_MS = (SIGNED_URL_TTL_SECONDS - 60) * 1000

/**
 * The display priority: uploaded photos come first, in position order, and any
 * legacy pasted URLs follow. Combined, a profile never shows more than six.
 */
const MAX_DISPLAY_PHOTOS = 6

interface CachedUrl {
  url: string | null
  expiresAt: number
}

const signedUrlCache = new Map<string, CachedUrl>()

function cached(path: string): string | null | undefined {
  const entry = signedUrlCache.get(path)
  if (!entry) return undefined
  if (entry.expiresAt <= Date.now()) {
    signedUrlCache.delete(path)
    return undefined
  }
  return entry.url
}

async function signPath(path: string): Promise<string | null> {
  const hit = cached(path)
  if (hit !== undefined) return hit

  const { data, error } = await supabase.storage
    .from('profile-photos')
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)

  // A missing object (seed paths, deleted files) comes back as an error. Cache
  // the null so we do not re-ask for the same dead path on every render.
  const url = !error && data ? data.signedUrl : null
  signedUrlCache.set(path, { url, expiresAt: Date.now() + CACHE_TTL_MS })
  return url
}

/** The approved uploads of a set of members, grouped by owner, in position order. */
export async function fetchApprovedMemberPhotos(
  userIds: string[]
): Promise<Map<string, { storage_path: string; position: number }[]>> {
  const byUser = new Map<string, { storage_path: string; position: number }[]>()

  if (userIds.length === 0) return byUser

  const { data, error } = await supabase
    .from('member_photos')
    .select('user_id, storage_path, position')
    .eq('moderation_status', 'approved')
    .in('user_id', userIds)
    .order('position', { ascending: true })

  if (error || !data) return byUser

  for (const row of data) {
    const list = byUser.get(row.user_id) ?? []
    list.push({ storage_path: row.storage_path, position: row.position })
    byUser.set(row.user_id, list)
  }
  return byUser
}

/** Signs every distinct path in one batched call, filling the cache. */
async function signPathsBatched(paths: string[]): Promise<void> {
  const fresh = [...new Set(paths)].filter((path) => cached(path) === undefined && !signedUrlCache.has(path))
  if (fresh.length === 0) return

  const { data, error } = await supabase.storage
    .from('profile-photos')
    .createSignedUrls(fresh, SIGNED_URL_TTL_SECONDS)

  for (const path of fresh) {
    const result = data?.find((entry) => entry.path === path)
    const url = !error && result && !result.error ? result.signedUrl : null
    if (!signedUrlCache.has(path)) {
      signedUrlCache.set(path, { url, expiresAt: Date.now() + CACHE_TTL_MS })
    }
  }
}

/**
 * Merges each profile's approved uploads (signed, in display order) ahead of
 * its pasted photos. Members whose uploads the viewer may not see contribute
 * nothing, so an empty result is indistinguishable from "no uploads".
 */
export async function mergeApprovedMemberPhotos(profiles: PublicProfile[]): Promise<PublicProfile[]> {
  if (profiles.length === 0) return profiles

  const ids = [...new Set(profiles.map((profile) => profile.id))]
  const byUser = await fetchApprovedMemberPhotos(ids)

  const allPaths = [...byUser.values()].flat().map((entry) => entry.storage_path)
  await signPathsBatched(allPaths)

  const uploadsByUser = new Map<string, string[]>()
  for (const [userId, entries] of byUser) {
    const urls: string[] = []
    for (const entry of entries) {
      const url = await signPath(entry.storage_path)
      if (url) urls.push(url)
    }
    uploadsByUser.set(userId, urls)
  }

  return profiles.map((profile) => {
    const uploads = uploadsByUser.get(profile.id) ?? []
    if (uploads.length === 0) return profile

    const pasted = Array.isArray(profile.photos) ? profile.photos : []
    return { ...profile, photos: [...uploads, ...pasted].slice(0, MAX_DISPLAY_PHOTOS) }
  })
}