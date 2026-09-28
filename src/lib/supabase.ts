import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'
import { SupabaseConfigError, readSupabaseConfig } from './supabaseConfig'

export { SupabaseConfigError, SUPABASE_ENV_KEYS, readSupabaseConfig } from './supabaseConfig'
export type { SupabaseConfig, SupabaseEnvKey } from './supabaseConfig'

/**
 * Creates the browser Supabase client.
 *
 * Only the anon key is ever used here. The service_role key bypasses Row Level
 * Security and must never reach the browser or the repository.
 *
 * @throws {SupabaseConfigError} when a required variable is missing or empty.
 */
export function createSupabaseClient() {
  const { url, anonKey, missingKeys } = readSupabaseConfig()

  if (missingKeys.length > 0) {
    throw new SupabaseConfigError(missingKeys)
  }

  return createClient<Database>(url as string, anonKey as string, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  })
}

export type SupabaseClient = ReturnType<typeof createSupabaseClient>

export const supabase: SupabaseClient = createSupabaseClient()
