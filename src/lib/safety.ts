import { supabase } from './supabase'

export type ReportReason =
  | 'fake_profile'
  | 'harassment'
  | 'scam'
  | 'inappropriate_photos'
  | 'underage'
  | 'solicitation'
  | 'other'

export interface ReportInput {
  reportedId: string
  reason: ReportReason
  details?: string
}

/**
 * Report a user. Inserts into the reports table.
 * Returns the report ID on success.
 */
export async function reportUser(input: ReportInput): Promise<{
  reportId: string | null
  error: string | null
}> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { reportId: null, error: 'You must be signed in to report a user.' }
  }

  const { data, error } = await supabase
    .from('reports')
    .insert({
      reporter_id: user.id,
      reported_id: input.reportedId,
      reason: input.reason,
      details: input.details?.trim() || null,
    })
    .select('id')
    .single()

  if (error) {
    return { reportId: null, error: error.message }
  }

  return { reportId: data.id, error: null }
}

/**
 * Block a user. Inserts into the blocks table.
 * After blocking, neither user will see each other in discovery, search, or chat.
 */
export async function blockUser(blockedId: string): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'You must be signed in to block a user.' }
  }

  const { error } = await supabase
    .from('blocks')
    .insert({
      blocker_id: user.id,
      blocked_id: blockedId,
    })

  if (error) {
    return { error: error.message }
  }

  return { error: null }
}

/**
 * Unblock a user. Deletes the block row.
 */
export async function unblockUser(blockedId: string): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'You must be signed in to unblock a user.' }
  }

  const { error } = await supabase
    .from('blocks')
    .delete()
    .eq('blocker_id', user.id)
    .eq('blocked_id', blockedId)

  if (error) {
    return { error: error.message }
  }

  return { error: null }
}

/**
 * Check if the current user has blocked another user.
 */
export async function isUserBlocked(blockedId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data } = await supabase
    .from('blocks')
    .select('id')
    .eq('blocker_id', user.id)
    .eq('blocked_id', blockedId)
    .single()

  return !!data
}

/**
 * Get the list of users the current user has blocked.
 */
export async function getBlockedUsers(): Promise<
  Array<{ id: string; full_name: string; photos: string[] }>
> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('blocks')
    .select(
      `
      blocked_id,
      blocked:profiles!blocks_blocked_id_fkey(id, full_name, photos)
    `
    )
    .eq('blocker_id', user.id)

  if (error || !data) return []

  return data
    .map((row) => row.blocked as { id: string; full_name: string; photos: string[] } | null)
    .filter((profile): profile is { id: string; full_name: string; photos: string[] } => !!profile)
}

/**
 * Client-side scam detection (mirrors the database function).
 * Returns true if the message contains phone number patterns AND money-related words.
 */
export function flagSuspiciousMessage(body: string): boolean {
  if (!body) return false

  // Phone patterns: +1234567890, (123) 456-7890, etc.
  const hasPhone = /\+?[0-9]{10,15}/.test(body) || /\(\d{3}\)\s*\d{3}[-\s]?\d{4}/.test(body)

  // Money-related words
  const moneyWords = /\b(money|gift\s*card|crypto|bitcoin|investment|western\s*union|upi|send\s*money)\b/i

  return hasPhone && moneyWords.test(body)
}
