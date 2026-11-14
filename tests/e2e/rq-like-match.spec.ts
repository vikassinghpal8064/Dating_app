import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

/**
 * The like → match → send-message journey, driven from a member profile page.
 *
 * ORDER NOTE: this file sorts alphabetically between `profile-likes-matches`
 * (read-only) and `search-discover`. It deliberately LIKES aarav and leaves
 * the pair matched: search-discover's deck test then re-triggers the mutual
 * pair on the deck (send_like is idempotent and returns the existing match),
 * and its REST assertion still finds the match row. Nothing here passes,
 * reports or blocks, so the deck candidate set is unchanged.
 */

const APP_ORIGIN = 'http://localhost:5173'
const DEMO_EMAIL = 'demo@local.test'
const DEMO_PASSWORD = 'Demo-Local-2026'
const DEMO_ID = '11111111-1111-4111-8111-111111111111'
const AARAV_ID = '20000000-0000-4000-8000-000000000001'

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

async function loginDemo(page: Page): Promise<void> {
  await gotoAndSettle(page, '/auth/login')
  await page.getByLabel('Email').fill(DEMO_EMAIL)
  await page.locator('#password').fill(DEMO_PASSWORD)
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

test.describe('Like → match → message on a profile, against the live stack', () => {
  test('liking an incoming like completes the pair, the modal opens, and the chat deep-links', async ({
    page,
  }) => {
    test.setTimeout(60_000)
    const appErrors = collectAppErrors(page)
    await loginDemo(page)

    // A fresh seed starts with aarav→demo one-sided, so the profile action
    // bar offers the like actions.
    await gotoAndSettle(page, `/app/profile/${AARAV_ID}`)
    await expect(page.getByRole('heading', { name: /Aarav Mehta,\s*\d+/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /^like aarav mehta$/i })).toBeVisible()

    // Liking back completes the reciprocal pair → the celebration modal.
    await page.getByRole('button', { name: /^like aarav mehta$/i }).click()
    await expect(
      page.getByRole('heading', { name: /a match/i })
    ).toBeVisible({ timeout: 15_000 })

    // "Send a message" deep-links into the thread that the match created.
    await page.getByRole('button', { name: /send a message/i }).click()
    await expect(page).toHaveURL(/\/app\/messages\/[0-9a-f-]{36}$/, { timeout: 15_000 })
    await expect(page.getByRole('heading', { name: 'Aarav Mehta' })).toBeVisible()
    await expect(page.getByPlaceholder(/^Message Aarav/)).toBeVisible()

    // The match is real, readable back through the viewer's own session.
    // (The UI updates optimistically; the server write settles a tick later,
    // so the REST read polls rather than racing the optimistic render.)
    await expect
      .poll(
        async () => {
          const matches = await memberRest(page, 'matches')
          return matches.some(
            (row) =>
              (row.user_id === DEMO_ID && row.matched_user_id === AARAV_ID) ||
              (row.user_id === AARAV_ID && row.matched_user_id === DEMO_ID)
          )
        },
        { timeout: 10_000 }
      )
      .toBe(true)

    // The matches list surfaces the pair with the "no messages yet" preview.
    await gotoAndSettle(page, '/app/matches')
    await expect(page.getByText('Aarav Mehta,', { exact: false }).first()).toBeVisible()
    await expect(page.getByText('Say hi to start the conversation')).toBeVisible()

    expect(appErrors).toEqual([])
  })
})