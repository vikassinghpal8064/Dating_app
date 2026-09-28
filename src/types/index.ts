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
  location_country: string
  /** Rounded to 2 decimal places on write. Never exposed to other users. */
  latitude: number | null
  longitude: number | null
  show_distance: boolean
  age_verified: boolean
  phone_verified: boolean
  whatsapp_consent: boolean
  is_admin: boolean
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