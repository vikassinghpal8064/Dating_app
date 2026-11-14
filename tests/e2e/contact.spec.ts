import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

/**
 * Consent-gated WhatsApp contact: request → approve → release, the never-mode
 * wall, the block override and the per-hour lookup cap, against the *real*
 * local Supabase stack with RLS active.
 *
 * Only accounts a browser session can actually use are driven in the browser:
 * demo and tanya are profile-complete (≥2 photos), so they pass the app guard.
 * aarav, diya and meera act through direct Supabase auth/REST calls with their
 * own seeded credentials — the same anon key the app ships, never a privileged
 * key — which sidesteps the completeness guard without touching the surfaces
 * the other files assert on.
 *
 * Mutations stay off the demo member's rows (the files reading the fresh seed
 * need demo to have liked nobody, aarav→demo one-sided and no demo matches):
 * matches are created on aarav↔diya and diya↔meera, and demo↔tanya gets a
 * request/approval plus a block that this file removes again.
 *
 * Files run in alphabetical order (app, auth-flow, contact, …). This file
 * sorts before onboarding/profile-likes-matches, both of which read the
 * fresh-seed demo state. `test.describe.configure({ mode: 'serial' })` keeps
 * the scenarios inside this file ordered too: each one seeds the next (the
 * approval flow grants demo a number before the block and rate-limit tests
 * reuse that same consent).
 *
 * The number-leak test is deliberately first: it proves no seeded number
 * reaches the browser in any app-origin byte — HTML, script or response body —
 * before any later scenario relies on one being *released* (by design the only
 * release point is the RPC that checks consent).
 */

const APP_ORIGIN = 'http://localhost:5173'
const DEMO_EMAIL = 'demo@local.test'
const DEMO_PASSWORD = 'Demo-Local-2026'
const SEED_PASSWORD = 'local-seed-only'
const AARAV_EMAIL = 'aarav@local.test'
const DIYA_EMAIL = 'diya@local.test'
const MEERA_EMAIL = 'meera@local.test'
const TANYA_EMAIL = 'tanya@local.test'
const DEMO_ID = '11111111-1111-4111-8111-111111111111'
const AARAV_ID = '20000000-0000-4000-8000-000000000001'
const DIYA_ID = '20000000-0000-4000-8000-000000000002'
const MEERA_ID = '20000000-0000-4000-8000-000000000006'
const TANYA_ID = '20000000-0000-4000-8000-000000000012'

// The four seeded numbers (seed.sql private_contacts). These strings are only
// ever compared against bytes in the browser — never rendered into it.
const AARAV_NUMBER = '+15550100002'
const MEERA_NUMBER = '+15550100004'
const TANYA_NUMBER = '+15550100005'

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

/** Sign in through the login form. The account must pass the app guard. */
async function loginAs(page: Page, email: string, password: string): Promise<void> {
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

/**
 * Sign a seeded member in over the auth REST endpoint (their own credentials,
 * the anon key only) and return their access token. Members who are not
 * profile-complete cannot browse the app, but their REST session is perfectly
 * valid — likes and matches are created this way.
 */
async function seedSessionToken(email: string, password: string): Promise<string> {
  const { url, anonKey } = readSupabaseConfig()
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new Error(`auth failed for ${email}: ${res.status}`)
  const body = (await res.json()) as { access_token: string }
  return body.access_token
}

interface RpcOutcome {
  ok: boolean
  data: unknown
  error: string | null
}

/** RPC call with an explicit bearer token (node-side, no page required). */
async function rpcAs(token: string, fn: string, args: Record<string, unknown> = {}): Promise<RpcOutcome> {
  const { url, anonKey } = readSupabaseConfig()
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  })
  const text = await res.text()
  let data: unknown
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  if (!res.ok) {
    const message =
      typeof data === 'object' && data !== null && 'message' in data
        ? String((data as { message: unknown }).message)
        : `HTTP ${res.status}`
    return { ok: false, data: null, error: message }
  }
  return { ok: true, data, error: null }
}

/** REST read as the signed-in member (RLS-scoped to their own session). */
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

/** Direct table write as the signed-in member (only self-owned rows, RLS). */
async function memberWrite(
  page: Page,
  method: 'POST' | 'DELETE',
  table: string,
  body?: Record<string, unknown>
): Promise<{ ok: boolean; error: string | null }> {
  const { url, anonKey } = readSupabaseConfig()
  const result = await page.evaluate(
    async ({ base, key, methodName, tableName, bodyValue }) => {
      const tokenKey =
        (localStorage.getItem('supabase.auth.token') !== null && 'supabase.auth.token') ||
        Object.keys(localStorage).find((name) => name.endsWith('-auth-token'))
      const token = tokenKey ? (JSON.parse(localStorage.getItem(tokenKey) ?? '{}').access_token ?? '') : ''
      const res = await fetch(`${base}/rest/v1/${tableName}`, {
        method: methodName,
        headers: {
          apikey: key,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: bodyValue ? JSON.stringify(bodyValue) : undefined,
      })
      return { ok: res.ok, error: res.ok ? null : (await res.text()).slice(0, 160) }
    },
    { base: url, key: anonKey, methodName: method, tableName: table, bodyValue: body },
  )
  return result
}

/** Intercept the app's own new-window calls so wa.me links can be asserted. */
async function stubWindowOpen(page: Page): Promise<void> {
  await page.evaluate(() => {
    const opened: string[] = []
    ;(window as unknown as { __openedUrls: string[] }).__openedUrls = opened
    const original = window.open.bind(window)
    window.open = ((url?: string | URL) => {
      if (url) opened.push(String(url))
      return original('about:blank') // keep a handle; tests never use it
    }) as typeof window.open
  })
}

test.describe.configure({ mode: 'serial' })

test.describe('Consent-gated WhatsApp contact against the live stack', () => {
  test('seeded numbers never reach the browser, and strangers get no affordance', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    const appErrors = collectAppErrors(page)

    const seededNumbers = [AARAV_NUMBER, MEERA_NUMBER, TANYA_NUMBER, '+15550100001']
    const leaks: string[] = []
    page.on('response', async (response) => {
      const url = new URL(response.url())
      if (url.origin !== APP_ORIGIN) return
      try {
        const body = await response.text()
        for (const number of seededNumbers) {
          if (body.includes(number)) leaks.push(`${number} in ${response.url()}`)
        }
      } catch {
        // A body that cannot be read as text is not an app byte we care about.
      }
    })

    await loginAs(page, DEMO_EMAIL, DEMO_PASSWORD)

    // A 'matches'-mode member is not askable by a stranger: no button at all.
    await gotoAndSettle(page, `/app/profile/${AARAV_ID}`)
    await expect(page.getByRole('heading', { name: /Aarav Mehta,\s*\d+/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /whatsapp/i })).toHaveCount(0)

    // A 'never'-mode member is equally quiet for a stranger.
    await gotoAndSettle(page, `/app/profile/${MEERA_ID}`)
    await expect(page.getByRole('heading', { name: /Meera Joshi,\s*\d+/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /whatsapp/i })).toHaveCount(0)

    // Neither number leaked into any app-origin byte during the whole session.
    expect(leaks).toEqual([])
    expect(appErrors).toEqual([])
  })

  test('an approved-mode member can be asked, and the number releases only after approval', async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000)
    const appErrors = collectAppErrors(page)

    await loginAs(page, DEMO_EMAIL, DEMO_PASSWORD)
    await gotoAndSettle(page, `/app/profile/${TANYA_ID}`)
    await expect(page.getByRole('heading', { name: /Tanya Bedi,\s*\d+/ })).toBeVisible()

    // 'approved' mode invites the request path: the WhatsApp button is on
    // every profile session, not just matched ones.
    const whatsapp = page.getByRole('button', { name: /whatsapp/i })
    await expect(whatsapp).toBeVisible()

    // No approval yet → silent denial, plus the request affordance.
    await whatsapp.click()
    await expect(page.getByTestId('whatsapp-denied')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: /^request whatsapp$/i })).toBeVisible()

    // Send the request; the panel confirms without ever showing a number.
    await page.getByRole('button', { name: /^request whatsapp$/i }).click()
    await expect(page.getByText(/request sent/i)).toBeVisible()
    await expect(page.getByText(/^\+1555/)).toHaveCount(0)

    // The request row is real, readable back through demo's own session.
    const mine = await memberRest(page, 'contact_requests')
    expect(mine.filter((row) => row.owner_id === TANYA_ID)).toHaveLength(1)

    // Switch to tanya in a fresh, isolated context: the settings gear lights
    // a dot and the request is listed with the requester's name.
    const tanyaContext = await browser.newContext()
    const tanyaPage = await tanyaContext.newPage()
    const tanyaErrors = collectAppErrors(tanyaPage)
    await loginAs(tanyaPage, TANYA_EMAIL, SEED_PASSWORD)
    await expect(
      tanyaPage.getByRole('link', { name: /settings, 1 unanswered whatsapp request/i })
    ).toBeVisible({ timeout: 15_000 })

    await gotoAndSettle(tanyaPage, '/app/settings')
    await expect(tanyaPage.getByRole('heading', { name: /whatsapp requests/i })).toBeVisible()
    await expect(tanyaPage.getByText('Demo Member').first()).toBeVisible()

    // Approving hands out the per-viewer grant in the same call.
    await tanyaPage.getByRole('button', { name: /^approve demo member/i }).click()
    await expect(tanyaPage.getByText('Approved').first()).toBeVisible({ timeout: 15_000 })
    await tanyaContext.close()

    // Back on demo: the same button now releases the number, through the
    // one-time safety prompt, straight into wa.me.
    await gotoAndSettle(page, `/app/profile/${TANYA_ID}`)
    await stubWindowOpen(page)
    await page.getByRole('button', { name: /whatsapp/i }).click()
    await expect(page.getByRole('heading', { name: /meet in public, stay safe/i })).toBeVisible({
      timeout: 15_000,
    })
    await page.getByRole('button', { name: /^open whatsapp$/i }).click()

    const opened = await page.evaluate(
      () => (window as unknown as { __openedUrls: string[] }).__openedUrls
    )
    expect(opened).toContain(`https://wa.me/${TANYA_NUMBER}`)

    expect(appErrors).toEqual([])
    expect(tanyaErrors).toEqual([])
  })

  test('a matched pair gets the number instantly, with no approval step', async ({ page }) => {
    test.setTimeout(120_000)
    const appErrors = collectAppErrors(page)

    // aarav and diya are both 'matches'-mode with numbers. Neither has a
    // browser session here; their seeded credentials drive the mutual likes
    // directly, and diya (profile-complete) browses the result.
    const aaravToken = await seedSessionToken(AARAV_EMAIL, SEED_PASSWORD)
    const diyaToken = await seedSessionToken(DIYA_EMAIL, SEED_PASSWORD)
    const aaravLike = await rpcAs(aaravToken, 'send_like', { target_user_id: DIYA_ID })
    expect(aaravLike.ok).toBe(true)
    const diyaLike = await rpcAs(diyaToken, 'send_like', { target_user_id: AARAV_ID })
    expect(diyaLike.ok).toBe(true)

    await loginAs(page, DIYA_EMAIL, SEED_PASSWORD)
    await expect
      .poll(
        async () => {
          const raw = await fetch(`${readSupabaseConfig().url}/rest/v1/matches?select=*`, {
            headers: {
              apikey: readSupabaseConfig().anonKey,
              Authorization: `Bearer ${diyaToken}`,
            },
          })
          const rows = (await raw.json()) as Record<string, unknown>[]
          return rows.some(
            (row) =>
              (row.user_id === AARAV_ID && row.matched_user_id === DIYA_ID) ||
              (row.user_id === DIYA_ID && row.matched_user_id === AARAV_ID)
          )
        },
        { timeout: 10_000 }
      )
      .toBe(true)

    // Matched → button, one click, one safety prompt, number straight out.
    await gotoAndSettle(page, `/app/profile/${AARAV_ID}`)
    await expect(page.getByRole('button', { name: /whatsapp/i })).toBeVisible()
    await stubWindowOpen(page)
    await page.getByRole('button', { name: /whatsapp/i }).click()
    await expect(page.getByRole('heading', { name: /meet in public, stay safe/i })).toBeVisible({
      timeout: 15_000,
    })
    await page.getByRole('button', { name: /^open whatsapp$/i }).click()

    const opened = await page.evaluate(
      () => (window as unknown as { __openedUrls: string[] }).__openedUrls
    )
    expect(opened).toContain(`https://wa.me/${AARAV_NUMBER}`)

    expect(appErrors).toEqual([])
  })

  test('a matched pair in never-mode still gets nothing, and reasons stay hidden', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const appErrors = collectAppErrors(page)

    // meera ('never') and diya match; diya browses meera's profile.
    const meeraToken = await seedSessionToken(MEERA_EMAIL, SEED_PASSWORD)
    const diyaToken = await seedSessionToken(DIYA_EMAIL, SEED_PASSWORD)
    const meeraLike = await rpcAs(meeraToken, 'send_like', { target_user_id: DIYA_ID })
    expect(meeraLike.ok).toBe(true)
    const diyaLike = await rpcAs(diyaToken, 'send_like', { target_user_id: MEERA_ID })
    expect(diyaLike.ok).toBe(true)

    await loginAs(page, DIYA_EMAIL, SEED_PASSWORD)
    await expect
      .poll(
        async () => {
          const raw = await fetch(`${readSupabaseConfig().url}/rest/v1/matches?select=*`, {
            headers: {
              apikey: readSupabaseConfig().anonKey,
              Authorization: `Bearer ${diyaToken}`,
            },
          })
          const rows = (await raw.json()) as Record<string, unknown>[]
          return rows.some(
            (row) =>
              (row.user_id === MEERA_ID && row.matched_user_id === DIYA_ID) ||
              (row.user_id === DIYA_ID && row.matched_user_id === MEERA_ID)
          )
        },
        { timeout: 10_000 }
      )
      .toBe(true)

    // Matched, so the button appears — but 'never' mode returns nothing, and
    // the UI says so without revealing the reason.
    await gotoAndSettle(page, `/app/profile/${MEERA_ID}`)
    await expect(page.getByRole('button', { name: /whatsapp/i })).toBeVisible()
    await page.getByRole('button', { name: /whatsapp/i }).click()
    await expect(page.getByTestId('whatsapp-denied')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/has not shared/i)).toBeVisible()
    // Not askable, and no number ever appears.
    await expect(page.getByRole('button', { name: /^request whatsapp$/i })).toHaveCount(0)
    await expect(page.getByText(/^\+1555/)).toHaveCount(0)

    expect(appErrors).toEqual([])
  })

  test('a block cancels the release even after approval, then restores', async ({ page }) => {
    test.setTimeout(90_000)
    const appErrors = collectAppErrors(page)
    await loginAs(page, DEMO_EMAIL, DEMO_PASSWORD)

    // demo holds tanya's approval (from the earlier scenario) and blocks her:
    // the block must trump the approval.
    const block = await memberWrite(page, 'POST', 'blocks', {
      blocker_id: DEMO_ID,
      blocked_id: TANYA_ID,
    })
    expect(block.ok).toBe(true)

    // get_profile returns no rows for a blocked target → the uninformative 404.
    await gotoAndSettle(page, `/app/profile/${TANYA_ID}`)
    await expect(
      page.getByRole('heading', { name: /profile isn’t available|profile is not available/i })
    ).toBeVisible({ timeout: 15_000 })

    // Restore: the pair is unblocked and the profile is reachable again.
    await memberWrite(page, 'DELETE', `blocks?blocker_id=eq.${DEMO_ID}&blocked_id=eq.${TANYA_ID}`)
    await gotoAndSettle(page, `/app/profile/${TANYA_ID}`)
    await expect(page.getByRole('heading', { name: /Tanya Bedi,\s*\d+/ })).toBeVisible()

    expect(appErrors).toEqual([])
  })

  test('the 20 lookups per hour cap refuses further attempts, counting attempts', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const appErrors = collectAppErrors(page)
    await loginAs(page, DEMO_EMAIL, DEMO_PASSWORD)

    // Earlier scenarios already consumed a couple of demo's attempts this
    // hour, so the 21st *attempt* — even though every call would succeed
    // (demo holds tanya's approval) — must be refused.
    let refused: string | null = null
    const { url, anonKey } = readSupabaseConfig()
    for (let attempt = 0; attempt < 21 && refused === null; attempt += 1) {
      const outcome = await page.evaluate(
        async ({ base, key, targetId }) => {
          const tokenKey =
            (localStorage.getItem('supabase.auth.token') !== null && 'supabase.auth.token') ||
            Object.keys(localStorage).find((name) => name.endsWith('-auth-token'))
          const token = tokenKey ? (JSON.parse(localStorage.getItem(tokenKey) ?? '{}').access_token ?? '') : ''
          const res = await fetch(`${base}/rest/v1/rpc/get_contact_link`, {
            method: 'POST',
            headers: {
              apikey: key,
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ target_user_id: targetId }),
          })
          if (res.ok) return { ok: true, error: null }
          const body = (await res.json()) as { message?: string }
          return { ok: false, error: body.message ?? `HTTP ${res.status}` }
        },
        { base: url, key: anonKey, targetId: TANYA_ID }
      )
      if (!outcome.ok) refused = outcome.error
    }
    expect(refused).not.toBeNull()
    expect(refused).toContain('Rate limited')

    expect(appErrors).toEqual([])
  })
})