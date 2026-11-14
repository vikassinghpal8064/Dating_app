import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

/**
 * Final flows that depend on the state earlier specs leave behind, so this file
 * sorts alphabetically LAST:
 *
 *  1. unmatch — demo↔aarav are matched by `rq-like-match` (and re-confirmed by
 *     `search-discover`); unmatching removes the thread for both.
 *  2. banned members and blocked members both read as the same 404 — Kabir is
 *     banned in the seed; diya is blocked (two-way) by demo right here, so the
 *     test is deterministic even if search-discover's block step skipped.
 *  3. the edit profile page saves, and the edited values surface in another
 *     member's search (demo → vivek's session).
 */

const APP_ORIGIN = 'http://localhost:5173'
const DEMO_EMAIL = 'demo@local.test'
const DEMO_PASSWORD = 'Demo-Local-2026'
const DEMO_ID = '11111111-1111-4111-8111-111111111111'
const AARAV_ID = '20000000-0000-4000-8000-000000000001'
const AARAV_EMAIL = 'aarav@local.test'
const DIYA_ID = '20000000-0000-4000-8000-000000000002'
const KABIR_ID = '20000000-0000-4000-8000-000000000005'
const SEED_PASSWORD = 'local-seed-only'
const BIO_MARKER = 'FINALTEST-2026-short-bio'

function collectAppErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    const location = msg.location()
    const isFromUs =
      !location.url || location.url.startsWith(APP_ORIGIN) || location.url.startsWith('/')
    if (isFromUs) errors.push(`[console] ${msg.text()}`)
  })
  page.on('pageerror', (error) => errors.push(`[pageerror] ${error.message}`))
  return errors
}

async function gotoAndSettle(page: Page, path: string) {
  await page.goto(path)
  await expect(page.locator('h1:visible, h2:visible').first()).toBeVisible({ timeout: 15_000 })
  await page.waitForLoadState('networkidle')
}

async function login(page: Page, email: string, password: string): Promise<void> {
  await gotoAndSettle(page, '/auth/login')
  await page.getByLabel('Email').fill(email)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: /^sign in$/i }).click()
  await expect(page).toHaveURL(/\/app\/discover$/, { timeout: 15_000 })
}

function readSupabaseConfig(): { url: string; anonKey: string } {
  const envDir = new URL('../../', import.meta.url)
  const readLayer = (file: string): string => {
    try {
      return readFileSync(new URL(file, envDir), 'utf8')
    } catch {
      return ''
    }
  }
  const layers = [readLayer('.env'), readLayer('.env.local')]
  const value = (key: string): string => {
    for (let i = layers.length - 1; i >= 0; i -= 1) {
      const line = layers[i].split('\n').find((row) => row.startsWith(`${key}=`))
      if (line) return line.slice(key.length + 1).replace(/^["']|["']$/g, '')
    }
    return ''
  }
  const url = value('VITE_SUPABASE_URL')
  const anonKey = value('VITE_SUPABASE_ANON_KEY')
  if (!url || !anonKey) throw new Error('.env(.local) is missing VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY')
  return { url, anonKey }
}

async function memberRest(page: Page, table: string): Promise<Record<string, unknown>[]> {
  const { url, anonKey } = readSupabaseConfig()
  const rows = await page.evaluate(
    async ({ base, key, tableName }) => {
      const tokenKey =
        (localStorage.getItem('supabase.auth.token') !== null && 'supabase.auth.token') ||
        Object.keys(localStorage).find((name) => name.endsWith('-auth-token'))
      const token = tokenKey ? (JSON.parse(localStorage.getItem(tokenKey) ?? '{}').access_token ?? '') : ''
      const res = await fetch(`${base}/rest/v1/${tableName}?select=*`, {
        headers: { apikey: key, Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`REST ${tableName} failed: ${res.status}`)
      return (await res.json()) as Record<string, unknown>[]
    },
    { base: url, key: anonKey, tableName: table },
  )
  return rows
}

/** POST one row as the page's signed-in member, ignoring duplicate conflicts. */
async function restInsert(page: Page, table: string, row: Record<string, unknown>): Promise<void> {
  const { url, anonKey } = readSupabaseConfig()
  const status = await page.evaluate(
    async ({ base, key, tableName, body }) => {
      const tokenKey =
        (localStorage.getItem('supabase.auth.token') !== null && 'supabase.auth.token') ||
        Object.keys(localStorage).find((name) => name.endsWith('-auth-token'))
      const token = tokenKey ? (JSON.parse(localStorage.getItem(tokenKey) ?? '{}').access_token ?? '') : ''
      const res = await fetch(`${base}/rest/v1/${tableName}`, {
        method: 'POST',
        headers: {
          apikey: key,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=ignore-duplicates',
        },
        body: JSON.stringify(body),
      })
      return res.status
    },
    { base: url, key: anonKey, tableName: table, body: row },
  )
  expect(status).toBeLessThan(300)
}

test.describe('Final flows: unmatch, privacy 404s, edit-and-search', () => {
  test('the matched pair can be unmatched and the thread disappears for good', async ({ page }) => {
    test.setTimeout(60_000)
    const appErrors = collectAppErrors(page)
    await login(page, DEMO_EMAIL, DEMO_PASSWORD)

    await gotoAndSettle(page, '/app/matches')
    await expect(page.getByText('Aarav Mehta,', { exact: false }).first()).toBeVisible()

    await page.getByRole('button', { name: /more options for aarav mehta/i }).click()
    await expect(
      page.getByRole('heading', { name: /unmatch with aarav mehta/i })
    ).toBeVisible()
    await page.getByRole('button', { name: /^unmatch$/i }).click()

    // Toast confirms; the row leaves the list.
    await expect(page.getByText('Unmatched', { exact: false }).first()).toBeVisible()
    await expect(page.getByText('Aarav Mehta,', { exact: false })).toHaveCount(0)

    // The thread is really gone, readable back through the viewer's session.
    const matches = await memberRest(page, 'matches')
    expect(
      matches.some(
        (row) =>
          (row.user_id === DEMO_ID && row.matched_user_id === AARAV_ID) ||
          (row.user_id === AARAV_ID && row.matched_user_id === DEMO_ID)
      )
    ).toBe(false)
    expect(appErrors).toEqual([])
  })

  test('a banned member and a blocked member both return the same 404', async ({ page }) => {
    test.setTimeout(60_000)
    const appErrors = collectAppErrors(page)
    await login(page, DEMO_EMAIL, DEMO_PASSWORD)

    // Kabir is banned in the seed — get_profile yields no rows.
    await gotoAndSettle(page, `/app/profile/${KABIR_ID}`)
    await expect(
      page.getByRole('heading', { name: /profile isn’t available|profile is not available/i })
    ).toBeVisible()

    // Make the block deterministic no matter whether search-discover's block
    // step ran: inserting the same pair again is a no-op under
    // ignore-duplicates.
    await restInsert(page, 'blocks', { blocker_id: DEMO_ID, blocked_id: DIYA_ID })

    // Same indistinguishable 404 for a member demo has blocked.
    await gotoAndSettle(page, `/app/profile/${DIYA_ID}`)
    await expect(
      page.getByRole('heading', { name: /profile isn’t available|profile is not available/i })
    ).toBeVisible()

    expect(appErrors).toEqual([])
  })

  test('editing the profile saves, and the edited values surface in another member’s search', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    const appErrors = collectAppErrors(page)
    await login(page, DEMO_EMAIL, DEMO_PASSWORD)

    // Edit bio to a unique marker and save.
    await gotoAndSettle(page, '/app/me/edit')
    await page.getByLabel('Bio').fill(BIO_MARKER)
    await page.getByRole('button', { name: /^save changes$/i }).click()
    await expect(page.getByText('Your profile has been saved.')).toBeVisible({ timeout: 15_000 })

    // The edit persisted, readable back through demo's own session.
    const own = await memberRest(page, 'profiles')
    const self = own.find((row) => row.id === DEMO_ID)
    expect(self?.bio).toBe(BIO_MARKER)

    // Second session as aarav in a fresh, isolated context: the demo page's
    // localStorage must not leak an auth token into aarav's browser. aarav's
    // profile is complete (two approved photos), so the onboarding guard lets
    // him in, and demo appears in his Mumbai search (no like/pass/block rule
    // removes her from search results).
    const viewerContext = await page.context().browser()!.newContext()
    const viewerPage = await viewerContext.newPage()
    await login(viewerPage, AARAV_EMAIL, SEED_PASSWORD)
    await gotoAndSettle(viewerPage, '/app/search')
    const cityBox = viewerPage.getByRole('combobox', { name: 'Search city' })
    await cityBox.fill('Mum')
    await expect(viewerPage.getByRole('option', { name: /Mumbai/ })).toBeVisible()
    await viewerPage.getByRole('option', { name: /Mumbai/ }).click()
    await expect(viewerPage).toHaveURL(/city=Mumbai/)
    await expect(viewerPage.getByText(/Demo Member/).first()).toBeVisible({ timeout: 15_000 })

    // And the value itself is what search serves: read the public projection
    // as aarav. Result cards hide the bio, so the REST read is the assertion.
    const visible = await memberRest(viewerPage, 'public_profiles')
    const demoRow = visible.find((row) => row.id === DEMO_ID)
    expect(demoRow).toBeDefined()
    expect(demoRow?.bio).toBe(BIO_MARKER)

    await viewerPage.close()
    await viewerContext.close()
    expect(appErrors).toEqual([])
  })
})