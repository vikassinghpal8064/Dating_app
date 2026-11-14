/**
 * Test helpers for creating and signing in test users via the Supabase auth
 * admin API. The service_role key is read from .env.test (git-ignored).
 *
 * These helpers are ONLY for e2e tests. The service_role key must NEVER appear
 * in src/ or in any committed file.
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load .env.test from the project root
config({ path: resolve(__dirname, '../../.env.test') })

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_ROLE_KEY) {
  throw new Error(
    'SUPABASE_SERVICE_ROLE_KEY not found in .env.test. Copy .env.test.example to .env.test and fill in your local service_role key.'
  )
}

// Admin client with service_role key (bypasses RLS)
const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

interface TestUser {
  email: string
  password: string
  id?: string
}

/**
 * Create a test user via the auth admin API. Returns the user's ID.
 */
export async function createTestUser({ email, password }: TestUser): Promise<string> {
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (error) throw error
  if (!data.user) throw new Error('Failed to create test user')

  return data.user.id
}

/**
 * Sign in a test user and return their session. Used to set up browser
 * contexts for e2e tests.
 */
export async function signInTestUser({ email, password }: TestUser) {
  const { data, error } = await adminClient.auth.signInWithPassword({
    email,
    password,
  })

  if (error) throw error
  if (!data.session) throw new Error('Failed to sign in test user')

  return data.session
}

/**
 * Delete a test user by email. Idempotent.
 */
export async function deleteTestUser(email: string): Promise<void> {
  const { data: users, error: listError } = await adminClient.auth.admin.listUsers()
  if (listError) throw listError

  const user = users.users.find((u) => u.email === email)
  if (!user) return // Already deleted

  const { error } = await adminClient.auth.admin.deleteUser(user.id)
  if (error) throw error
}

/**
 * Clean up all test users (emails matching the test pattern).
 */
export async function cleanupTestUsers(): Promise<void> {
  const { data: users, error } = await adminClient.auth.admin.listUsers()
  if (error) throw error

  const testUsers = users.users.filter((u) => u.email?.includes('@test.local'))
  for (const user of testUsers) {
    await adminClient.auth.admin.deleteUser(user.id)
  }
}
