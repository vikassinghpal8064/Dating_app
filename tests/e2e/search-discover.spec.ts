import { test, expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

/**
 * End-to-end Search + Discover against the *real* local Supabase stack.
 *
 * Same ground rules as auth-flow/onboarding: the stack and Mailpit must be
 * running (`supabase start`), and assertions go through the actual UI and then
 * read the database back through the REST API as the signed-in member (RLS
 * applies, so we only ever see rows our own session can see).
 *
 * What this file proves beyond the unit tests:
 *  - the /discover deck renders the seeded candidates with privacy-safe
 *    distance buckets (never raw kilometres),
 *  - pressing ←/→/↑ or the buttons fires the real `send_like` RPC, and a
 *    mutual pair pops the "It's a match!" modal (server-authoritative),
 *  - the ⋯ overflow menu files a report and a two-way block, and both rows
 *    land in the database readable by this member's session,
 *  - /search drives every filter through the URL: picking a gazetteer city
 *    and a radius ring writes `?city=&radius=` and survives a reload (a
 *    shared link shows the same grid), and the server resolves the city
 *    centre so the browser never sends coordinates.
 *
 * NOTE on state: the destructive test (report + block) consumes seeded rows.
 * `entities like passing/blocking drain the demo deck and the reports unique
 * pair is one-shot, so that test needs a fresh `supabase db reset` before it
 * can run again; it skips cleanly (not fails) once the state is gone. The
 * deck/match and search tests are idempotent.
 */

const APP_ORIGIN = 'http://localhost:5173'
const DEMO_EMAIL = 'demo@local.test'
const DEMO_PASSWORD = 'Demo-Local-2026'
const DEMO_ID = '11111111-1111-4111-8111-111111111111'
const AARAV_ID = '20000000-0000-4000-8000-000000000001'
const DIYA_ID = '20000000-0000-4000-8000-000000000002'

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

/** The password field; `getByLabel` misses it because of the visible `*`. */
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

/** The swipe deck's keyboard-focusable surface. */
function deckSurface(page: Page): Locator {
  return page.getByLabel(/swipe deck/i)
}

/** The name+age headline on the top card. */
function topCardHeading(page: Page): Locator {
  return page.getByTestId('swipe-card').locator('h2').first()
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
    // Later layers win, mirroring Vite's override order.
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

test.describe('Discover deck against the live stack', () => {
  test('the like completes the seeded mutual pair and the match modal appears', async ({
    page,
  }) => {
    test.setTimeout(60_000)
    const appErrors = collectAppErrors(page)
    await loginDemo(page)

    // First card is the nearest candidate, distance shown as a bucket, never
    // a raw kilometre value.
    const card = page.getByTestId('swipe-card')
    await expect(card).toBeVisible({ timeout: 15_000 })
    await expect(topCardHeading(page)).toContainText(/Aarav Mehta,\s*\d+/)
    await expect(card.getByText('Less than 1 km away')).toBeVisible()

    // Keyboard path: focus the deck, then ArrowRight = like.
    await deckSurface(page).focus()
    await expect(deckSurface(page)).toBeFocused()
    await page.keyboard.press('ArrowRight')

    // The seed gives mutual likes for demo↔aarav, so the server reports a
    // match and the celebration modal appears.
    await expect(
      page.getByRole('heading', { name: /a match/i })
    ).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: /keep swiping/i }).click()
    await expect(page.getByRole('heading', { name: /a match/i })).toBeHidden()

    // The match row is real: the demo member's own session can read it back.
    const matches = await memberRest(page, 'matches')
    const pair = matches.some(
      (row) =>
        (row.user_id === DEMO_ID && row.matched_user_id === AARAV_ID) ||
        (row.user_id === AARAV_ID && row.matched_user_id === DEMO_ID)
    )
    expect(pair).toBe(true)

    expect(appErrors).toEqual([])
  })

  test('the overflow menu reports and blocks a member, writing rows back', async ({ page }) => {
    test.setTimeout(60_000)
    const appErrors = collectAppErrors(page)
    await loginDemo(page)

    const card = page.getByTestId('swipe-card')
    await expect(card).toBeVisible({ timeout: 15_000 })
    await expect(topCardHeading(page)).toContainText(/Aarav Mehta,\s*\d+/)

    // The reports table enforces one report per pair, so a second run cannot
    // repeat the report step; drain the deck and skip instead of failing.
    const reports = await memberRest(page, 'reports')
    const alreadyReported = reports.some(
      (row) => row.reporter_id === DEMO_ID && row.reported_id === AARAV_ID
    )
    test.skip(alreadyReported, 'demo has already reported aarav — run `supabase db reset` for fresh demo state')

    // File a report from the ⋯ menu. Reporting does not hide the member, so
    // the next run's deck still starts with the same candidates.
    await page.getByRole('button', { name: /^more options for/i }).click()
    await page.getByRole('button', { name: /^report [^m]/i }).click()
    await page.getByLabel('Reason').selectOption('harassment')
    await page.getByRole('button', { name: /^submit report$/i }).click()
    await expect(page.getByRole('button', { name: /^submit report$/i })).toBeHidden()

    const reportsAfter = await memberRest(page, 'reports')
    expect(
      reportsAfter.some(
        (row) =>
          row.reporter_id === DEMO_ID &&
          row.reported_id === AARAV_ID &&
          row.reason === 'harassment'
      )
    ).toBe(true)

    // The report consumes the card; the next candidate (diya on a fresh seed)
    // is the block target. Blocking is two-way and permanent.
    await expect(card).toBeVisible()
    await expect(topCardHeading(page)).not.toContainText(/Aarav/)
    await page.getByRole('button', { name: /^more options for/i }).click()
    await page.getByRole('button', { name: /^block [^m]/i }).click()
    await page.getByRole('button', { name: /^block member$/i }).click()
    await expect(page.getByRole('button', { name: /^block member$/i })).toBeHidden()

    const blocks = await memberRest(page, 'blocks')
    expect(
      blocks.some((row) => row.blocker_id === DEMO_ID && row.blocked_id === DIYA_ID)
    ).toBe(true)

    // The deck runs dry — the only candidates within the demo's 50 km radius
    // were aarav and diya, and both have now been acted on.
    await expect(page.getByTestId('swipe-card')).toHaveCount(0)

    expect(appErrors).toEqual([])
  })
})

test.describe('Search against the live stack', () => {
  test('every filter lives in the URL and survives a reload', async ({ page }) => {
    test.setTimeout(60_000)
    const appErrors = collectAppErrors(page)
    await loginDemo(page)
    await gotoAndSettle(page, '/app/search')

    await expect(page.getByRole('heading', { name: /^search$/i })).toBeVisible()

    // Pick a city from the gazetteer; the option click commits the name only.
    const cityBox = page.getByRole('combobox', { name: 'Search city' })
    await cityBox.fill('Beng')
    await expect(page.getByRole('option', { name: /Bengaluru/ })).toBeVisible()
    await page.getByRole('option', { name: /Bengaluru/ }).click()

    await expect(page).toHaveURL(/city=Bengaluru/)
    await expect(page.getByLabel('Clear city Bengaluru')).toBeVisible()
    await expect(page.getByText(/2 members found/)).toBeVisible({ timeout: 15_000 })
    // Buckets, not distances: vivek is at the city centre, tanya ~2.5 km out.
    await expect(page.getByText('Less than 1 km away').first()).toBeVisible()
    await expect(page.getByText('1 to 5 km away').first()).toBeVisible()

    // Radius ring goes into the same URL.
    await page.getByRole('button', { name: 'Within 10 km' }).click()
    await expect(page).toHaveURL(/radius=10/)

    // A reload rebuilds the whole page from the URL — a shared link behaves
    // the same for every viewer, and no coordinates ever travel in it.
    await page.reload()
    await expect(page.getByRole('button', { name: 'Within 10 km' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await expect(page.getByLabel('Clear city Bengaluru')).toBeVisible()
    await expect(page.getByText(/2 members found/)).toBeVisible({ timeout: 15_000 })

    // Clearing the city drops only the city param; the radius ring stays.
    await page.getByLabel('Clear city Bengaluru').click()
    await expect(page).not.toHaveURL(/city=/)
    await expect(page).toHaveURL(/radius=10/)
    await expect(page.getByLabel('Clear city Bengaluru')).toBeHidden()

    expect(appErrors).toEqual([])
  })
})