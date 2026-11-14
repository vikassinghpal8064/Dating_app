import type { DistanceBucketId } from '../utils/distance'

export interface UserProfile {
  id: string
  email: string
  full_name: string
  date_of_birth: string
  gender: 'male' | 'female' | 'non_binary' | 'prefer_not_to_say'
  interested_in: ('male' | 'female' | 'non_binary' | 'everyone')[]
  bio: string
  photos: string[]
  location_city: string
  location_state: string | null
  location_country: string
  /** Rounded to 2 decimal places on write. Never exposed to other users. */
  latitude: number | null
  longitude: number | null
  height_cm: number | null
  education: string | null
  occupation: string | null
  looking_for: 'casual' | 'serious' | 'friends' | 'unsure'
  interests: string[]
  languages: string[]
  smoking: 'never' | 'occasionally' | 'regularly' | 'quitting'
  drinking: 'never' | 'socially' | 'regularly' | 'quitting'
  exercise: 'never' | 'sometimes' | 'often' | 'daily'
  show_distance: boolean
  age_verified: boolean
  phone_verified: boolean
  whatsapp_consent: boolean
  is_admin: boolean
  is_verified: boolean
  /** Member-controlled: when true, the profile is paused and hidden everywhere. */
  profile_paused: boolean
  created_at: string
  updated_at: string
  /**
   * Client-side only: how many uploaded photos this member has in
   * `member_photos`. `photos` still holds pasted URLs; the two are merged
   * (uploads take display priority) wherever photos are rendered.
   */
  photos_count?: number
}

/** One row of `member_photos` as the client reads it. */
export interface MemberPhoto {
  id: string
  user_id: string
  storage_path: string
  position: number
  moderation_status: 'pending' | 'approved' | 'rejected'
  created_at: string
  updated_at: string
}

export interface PublicProfile {
  id: string
  full_name: string
  age: number
  gender: string
  interested_in: string[]
  bio: string
  photos: string[]
  location_city: string
  location_country: string
  /** `null` when the distance could not be computed (no coordinates on one side). */
  distance_km?: number | null
  is_online: boolean
  last_active: string
}

export interface Match {
  id: string
  user_id: string
  /**
   * The two members, in the database's canonical order (`user_id` is always the
   * smaller uuid). Neither column means "me" and neither means "them" — use
   * `matched_user`, which is resolved relative to the signed-in user.
   */
  matched_user_id: string
  /** Always the *other* person, whichever of the two ids that turns out to be. */
  matched_user: PublicProfile
  created_at: string
  last_message_at?: string
  /** Text of the latest message in the thread, when there is one. */
  last_message?: string | null
  unread_count: number
}

export interface Message {
  id: string
  match_id: string
  sender_id: string
  content: string
  message_type: 'text' | 'image' | 'whatsapp_request'
  /** `null` until the recipient has read it. */
  read_at?: string | null
  created_at: string
}

export interface WhatsAppConsent {
  id: string
  user_id: string
  matched_user_id: string
  status: 'pending' | 'approved' | 'declined' | 'revoked'
  whatsapp_number?: string | null
  requested_at: string
  responded_at?: string | null
}

export interface UserPreferences {
  user_id: string
  min_age: number
  max_age: number
  max_distance_km: number
  show_me_to: 'everyone' | 'interested_in_me' | 'matches_only'
  notifications: {
    new_match: boolean
    new_message: boolean
    whatsapp_request: boolean
    profile_liked: boolean
  }
  privacy: {
    show_distance: boolean
    show_online_status: boolean
    show_last_active: boolean
  }
}

export interface AuthState {
  user: UserProfile | null
  session: unknown | null
  /**
   * `true` only until the initial session lookup has resolved. The route guards
   * block on it, so nothing else may set it — in particular an in-flight sign in
   * or sign up must not, or the guard replaces the form with its spinner and
   * discards the state the form was holding.
   */
  loading: boolean
  /** Set when the signed-in user's profile record could not be read. */
  error: string | null
}

export interface ApiResponse<T> {
  data: T | null
  error: string | null
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  page_size: number
  has_more: boolean
}

export type Gender = 'male' | 'female' | 'non_binary' | 'prefer_not_to_say'
export type InterestedIn = 'male' | 'female' | 'non_binary' | 'everyone'
export type MessageType = 'text' | 'image' | 'whatsapp_request'
export type WhatsAppConsentStatus = 'pending' | 'approved' | 'declined' | 'revoked'

/** The "looking for" intent a member set on their profile. */
export type LookingFor = 'casual' | 'serious' | 'friends' | 'unsure'

/** A person the signed-in member could be shown in /search or /discover. */
export interface SearchProfile extends PublicProfile {
  /** Coarse server-side distance band. `null` when no reliable centre exists. */
  distance_bucket: DistanceBucketId | null
  is_verified: boolean
  looking_for: LookingFor
  interests: string[]
  height_cm: number | null
}

/**
 * Everything a member's public /profile/:id page can show. Built from the
 * `get_profile` RPC, which returns no rows for hidden, banned, blocked,
 * self or missing targets — so `null` here always means "not available".
 */
export interface ProfileDetail extends PublicProfile {
  distance_bucket: DistanceBucketId | null
  is_verified: boolean
  looking_for: LookingFor | null
  interests: string[]
  height_cm: number | null
  education: string | null
  occupation: string | null
  languages: string[]
  smoking: string | null
  drinking: string | null
  exercise: string | null
  is_match: boolean
  /** Present exactly when `is_match` — deep-links into the chat. */
  match_id: string | null
  viewer_liked_type: 'like' | 'super_like' | null
  liked_viewer: boolean
  /**
   * Whether the target's contact consent mode is 'approved' — the one state in
   * which an unmatched viewer may ask for their number. `null` means the mode
   * is unknown (a matches-mode or never-mode target simply never shows the
   * request affordance).
   */
  contact_can_request: boolean
}

/** One city gazetteer row, returned by the autocomplete RPC-free read. */
export interface CityOption {
  city: string
  country: string
  latitude: number
  longitude: number
}

/** What the distance slider may offer. `null` means "anywhere". */
export type DistanceRadiusKm = 5 | 10 | 25 | 50 | 100

/** The gender side of a profile *search*: the member's own gender. */
export type SearchGender = 'everyone' | 'male' | 'female' | 'non_binary'

/** Everything the /search page filters by, mirroring the URL query string. */
export interface SearchFilters {
  /** Selected city name, or `null` for "everywhere". */
  city: string | null
  /** Distance ring around the search centre; `null` = no radius bound. */
  radiusKm: DistanceRadiusKm | null
  minAge: number
  maxAge: number
  gender: SearchGender
  lookingFor: LookingFor[]
  verifiedOnly: boolean
  onlineOnly: boolean
  interests: string[]
  minHeightCm: number | null
  maxHeightCm: number | null
}

/** The shape the deck needs to know after a like/pass action. */
export interface LikeActionResult {
  ok: boolean
  error: string | null
  /** `true` only when this like completed a mutual pair. */
  matched: boolean
  matchId: string | null
  createdAt: string | null
}