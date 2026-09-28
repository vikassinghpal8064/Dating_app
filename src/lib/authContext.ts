import { createContext, useContext } from 'react'
import type { AuthState, UserProfile } from '../types'

export interface SignUpData {
  email: string
  password: string
  fullName: string
  dateOfBirth: string
  gender: UserProfile['gender']
  interestedIn: UserProfile['interested_in']
  locationCity: string
  locationCountry: string
}

/**
 * The columns of `profiles` a user is allowed to change on themselves.
 * `is_admin`, `age_verified`, `phone_verified`, `email` and `id` are
 * deliberately absent: they are server-managed and must never be written
 * from the client.
 */
export type EditableProfileFields = Partial<
  Pick<
    UserProfile,
    | 'full_name'
    | 'bio'
    | 'photos'
    | 'location_city'
    | 'location_country'
    | 'interested_in'
    | 'show_distance'
    | 'whatsapp_consent'
  >
>

export interface AuthContextValue extends AuthState {
  signUp: (data: SignUpData) => Promise<{ error: Error | null }>
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: Error | null }>
  updateProfile: (data: EditableProfileFields) => Promise<{ error: Error | null }>
  refreshProfile: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }

  return context
}
