import { test, expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

/**
 * End-to-end Profile page, Likes, Matches and the profile-pause switch,
 * against the *real* local Supabase stack.
 *
 * Same ground rules as search-discover: assertions go through the UI, and then
 * the database is read back through the REST API as the signed-in member (RLS
 * applies, so only rows the session may see are readable).
 *
 * ORDER NOTE: this file sorts before search-discover.spec.ts, so it must not
 * mutate the demo member's like/match state — search-discover's deck test
 * depends on a fresh seed where demo has liked nobody and the aarav→demo like
 * is still one-sided. Everything here is read-only except the pause switch,
 * which is toggled on and back off (self-restoring) and verified via REST.
 */

const APP_ORIGIN = 'http://localhost:5173'
const DEMO_EMAIL = 'demo@local.test'
const DEMO_PASSWORD = 'Demo-Local-2026'
const DEMO_ID = '11111111-1111-4111-8111-111111111111'
const AARAV_ID = '20000000-0000-4000-8000-000000000001'
const GONE_ID = '00000000-0000-4000-8000-000000000000'

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

function passwordField(page: Page, id = 'password'): Locator {
  return page.locator(`#${id}`)
}

function submitButton(page: Page): Locator {
  return page.getByRole('button', { name: /^(create account|sign in|creating account…|signing in…)$/i })
}

async function loginDemo(page: Page): Promise<void> {
  await gotoAndSettle(page, '/auth/login')
  await page.getByLabel('Email').fill(DEMO_EMAIL)
  await passwordField(page).fill(DEMO_PASSWORD)
  await submitButton(page).click()
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

/** REST query as the signed-in member (RLS-scoped to their own session). */
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

test.describe('Profile page, Likes, Matches against the live stack', () => {
  test('likes tab shows the one-sided incoming like and the badge drains nothing yet', async ({
    page,
  }) => {
    test.setTimeout(60_000)
    const appErrors = collectAppErrors(page)
    await loginDemo(page)

    // Fresh seed: aarav→demo is the only incoming like, so the nav badge
    // shows one new like and nothing is unread. (Desktop badge, visible at the
    // default viewport; the mobile layout carries the same count.)
    await expect(page.getByLabel('1 new likes')).toBeVisible({ timeout: 15_000 })

    await gotoAndSettle(page, '/app/likes')
    await expect(page.getByRole('heading', { name: /^likes$/i })).toBeVisible()

    // Received tab default: the liker is a person, with a coarse distance.
    await expect(page.getByText('Aarav Mehta,', { exact: false }).first()).toBeVisible()
    await expect(page.getByText('Liked you').first()).toBeVisible()
    await expect(page.getByText('Less than 1 km away', { exact: false }).first()).toBeVisible()

    // Sent tab is empty on a fresh seed — demo has liked nobody.
    await page.getByRole('tab', { name: 'You liked' }).click()
    await expect(page.getByRole('heading', { name: /nothing sent yet/i })).toBeVisible()

    // The list is backed by the view: demo can read the incoming like back.
    const likesReceived = await memberRest(page, 'likes_received')
    expect(
      likesReceived.some((row) => row.liker_id === AARAV_ID)
    ).toBe(true)

    expect(appErrors).toEqual([])
  })

  test('profile page renders sections and a 404 that reveals nothing', async ({ page }) => {
    test.setTimeout(60_000)
    const appErrors = collectAppErrors(page)
    await loginDemo(page)

    await gotoAndSettle(page, `/app/profile/${AARAV_ID}`)
    await expect(page.getByRole('heading', { name: /Aarav Mehta,\s*\d+/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: /^about$/i })).toBeVisible()
    await expect(page.getByText('Less than 1 km away', { exact: false }).first()).toBeVisible()
    // Not matched yet on a fresh seed: the like/pass actions are available.
    await expect(page.getByRole('button', { name: /^like aarav mehta$/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^pass on aarav mehta$/i })).toBeVisible()

    // The member's own id has no profile page — it redirects to /me.
    await gotoAndSettle(page, `/app/profile/${DEMO_ID}`)
    await expect(page).toHaveURL(/\/app\/me$/)

    // A gone / hidden / blocked target is one indistinguishable 404.
    await gotoAndSettle(page, `/app/profile/${GONE_ID}`)
    await expect(
      page.getByRole('heading', { name: /profile isn’t available|profile is not available/i })
    ).toBeVisible()

    expect(appErrors).toEqual([])
  })

  test('matches page shows the honest empty state when there is no match yet', async ({ page }) => {
    test.setTimeout(60_000)
    const appErrors = collectAppErrors(page)
    await loginDemo(page)

    await gotoAndSettle(page, '/app/matches')
    await expect(page.getByRole('heading', { name: /^matches$/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /no matches yet|no matches/i })).toBeVisible()

    expect(appErrors).toEqual([])
  })

  test('the pause switch hides and restores the profile, verified back through REST', async ({
    page,
  }) => {
    test.setTimeout(60_000)
    const appErrors = collectAppErrors(page)
    await loginDemo(page)

    await gotoAndSettle(page, '/app/me')
    await expect(page.getByRole('heading', { name: 'Profile visibility' })).toBeVisible()

    const toggle = page.getByRole('checkbox', { name: /profile is (visible|paused)/i })
    await expect(toggle).toBeVisible()

    // Pause: derived is_visible drops to false (the member controls the flag,
    // the server derives visibility from it). The switch input itself is
    // sr-only, so the label (a real target for pointer input) is clicked.
    const selfRead = async () =>
      (await memberRest(page, 'profiles')).find((row) => row.id === DEMO_ID)

    await page.getByText('Profile is visible').click()
    await expect(page.getByText('Profile is paused')).toBeVisible()
    // The UI flips optimistically; give the PATCH a moment to land before the
    // REST read asserts the persisted state.
    await expect
      .poll(async () => (await selfRead())?.profile_paused, { timeout: 10_000 })
      .toBe(true)
    expect((await selfRead())?.is_visible).toBe(false)

    // Restore.
    await page.getByText('Profile is paused').click()
    await expect(page.getByText('Profile is visible')).toBeVisible()
    await expect
      .poll(async () => (await selfRead())?.profile_paused, { timeout: 10_000 })
      .toBe(false)
    expect((await selfRead())?.is_visible).toBe(true)

    expect(appErrors).toEqual([])
  })
})