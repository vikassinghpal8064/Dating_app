/**
 * Pure, side-effect-free reading of the public Supabase configuration.
 *
 * Kept separate from `supabase.ts` so the UI can report a configuration
 * problem without importing (and therefore throwing from) the client module.
 */

export const SUPABASE_ENV_KEYS = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'] as const

export type SupabaseEnvKey = (typeof SUPABASE_ENV_KEYS)[number]

export class SupabaseConfigError extends Error {
  readonly missingKeys: readonly string[]

  constructor(missingKeys: readonly string[]) {
    super(
      [
        'HeartConnect is not configured: missing required environment variable(s)',
        ...missingKeys.map((key) => `  - ${key}`),
        '',
        'Fix:',
        '  1. cp .env.example .env',
        '  2. Fill in the values from your Supabase project settings',
        '     (Project Settings -> API). Use the anon/public key only.',
        '  3. Restart the dev server.',
        '',
        'The service_role key must NEVER be placed in a VITE_* variable:',
        'anything prefixed with VITE_ is inlined into the public browser bundle.',
      ].join('\n')
    )
    this.name = 'SupabaseConfigError'
    this.missingKeys = missingKeys
  }
}

export interface SupabaseConfig {
  url: string | undefined
  anonKey: string | undefined
  missingKeys: SupabaseEnvKey[]
}

export function readSupabaseConfig(): SupabaseConfig {
  const env = import.meta.env
  const url = env.VITE_SUPABASE_URL?.trim()
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim()

  const missingKeys: SupabaseEnvKey[] = []
  if (!url) missingKeys.push('VITE_SUPABASE_URL')
  if (!anonKey) missingKeys.push('VITE_SUPABASE_ANON_KEY')

  return { url, anonKey, missingKeys }
}
