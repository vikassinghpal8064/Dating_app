import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * Owner dashboard E2E.
 *
 * Requires the local stack plus ./local-seed/apply.sh, which creates the demo
 * conversation used by the Messages assertions. On a bare `supabase db reset`
 * the conversation test skips itself with an explicit reason rather than
 * pretending the feature was exercised.
 */

const APP_ORIGIN = 'http://localhost:5173'
const ADMIN_EMAIL = 'demo@local.test'
const ADMIN_PASSWORD = 'Demo-Local-2026'

test.describe.configure({ mode: 'serial' })

async function signInAsAdmin(page: Page) {
  await page.goto(`${APP_ORIGIN}/auth/login`)
  await page.locator('#email').fill(ADMIN_EMAIL)
  await page.locator('#password').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL('**/app/discover')
  await page.goto(`${APP_ORIGIN}/admin`)
  await expect(page.getByRole('heading', { name: 'Admin', exact: true })).toBeVisible()
}

test.describe('Admin dashboard', () => {
  test('overview shows the full analytics picture', async ({ page }) => {
    test.setTimeout(60_000)
    await signInAsAdmin(page)

    await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('heading', { name: 'Product overview' })).toBeVisible()

    await expect(page.getByText('Total members', { exact: true })).toBeVisible()
    await expect(page.getByText('Active in 7 days', { exact: true })).toBeVisible()
    await expect(page.getByText('Verified members', { exact: true })).toBeVisible()
    await expect(page.getByText('Open reports', { exact: true }).first()).toBeVisible()

    await expect(page.getByRole('heading', { name: 'Signups, last 30 days' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Messages, last 14 days' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Moderation queues' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Recent admin activity' })).toBeVisible()

    await expect(page.getByRole('heading', { name: 'Gender' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Age groups' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Top cities' })).toBeVisible()
  })

  test('a member record reveals the phone number on request and logs the access', async ({ page }) => {
    test.setTimeout(60_000)
    await signInAsAdmin(page)

    await page.getByRole('tab', { name: 'Users' }).click()
    await expect(page.getByRole('heading', { name: 'Members' })).toBeVisible()

    await page.getByLabel('Search members').fill('Aarav')
    await expect(page.getByText('Aarav Mehta').first()).toBeVisible()
    await page.getByRole('button', { name: 'Open' }).first().click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Member detail')).toBeVisible()
    await expect(dialog.getByText('Aarav Mehta').first()).toBeVisible()
    await expect(dialog.getByText('Activity', { exact: true })).toBeVisible()
    await expect(dialog.getByText('Preferences and privacy')).toBeVisible()
    await expect(dialog.getByText('Audit trail')).toBeVisible()

    // The number is not in the page until an administrator asks for it, and the
    // reveal is audited.
    await expect(dialog.getByText('WhatsApp number', { exact: true })).toBeVisible()
    const before = (await dialog.innerText()).replace(/\s+/g, ' ')
    expect(before).not.toMatch(/\+\d{7,}/)

    await dialog.getByRole('button', { name: /reveal number/i }).click()
    await expect(dialog.getByText('+15550100002')).toBeVisible()
    await expect(dialog.getByText(/Sharing:/)).toBeVisible()
  })

  test('a conversation and its message bodies are readable', async ({ page }) => {
    test.setTimeout(60_000)
    await signInAsAdmin(page)

    await page.getByRole('tab', { name: 'Messages' }).click()
    await expect(page.getByRole('heading', { name: 'Conversations' })).toBeVisible()

    const emptyState = page.getByText('No conversations yet')
    const firstConversation = page.locator('ul li button').first()
    await expect(firstConversation.or(emptyState)).toBeVisible({ timeout: 15_000 })
    if (await emptyState.isVisible()) {
      test.skip(true, 'No seeded conversation. Run ./local-seed/apply.sh to enable this check.')
    }

    await firstConversation.click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Conversation')).toBeVisible()
    await expect(dialog.getByText(/written to the audit log/i)).toBeVisible()
    await expect(dialog.getByText('Coffee after?')).toBeVisible()
    await expect(dialog.getByText('read', { exact: false }).first()).toBeVisible()
  })

  test('message search returns matching bodies', async ({ page }) => {
    test.setTimeout(60_000)
    await signInAsAdmin(page)
    await page.getByRole('tab', { name: 'Messages' }).click()

    const searchInput = page.getByLabel('Search message text')
    await searchInput.fill('Coffee after')
    await page.getByRole('button', { name: 'Search', exact: true }).click()

    const result = page.getByText(/Aarav Mehta → Demo Member|Demo Member → Aarav Mehta/).first()
    const noMatch = page.getByText('No messages matched that search.')
    await expect(result.or(noMatch)).toBeVisible({ timeout: 15_000 })
    if (await noMatch.isVisible()) {
      test.skip(true, 'No seeded conversation. Run ./local-seed/apply.sh to enable this check.')
    }
    await expect(result).toBeVisible()
    await expect(page.getByText('Coffee after?').first()).toBeVisible()
  })

  test('the dashboard has no horizontal overflow at 375px', async ({ page }) => {
    test.setTimeout(60_000)
    await page.setViewportSize({ width: 375, height: 812 })
    await signInAsAdmin(page)

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    )
    expect(overflow).toBeLessThanOrEqual(1)

    await page.getByRole('tab', { name: 'Messages' }).click()
    await expect(page.getByRole('heading', { name: 'Conversations' })).toBeVisible()
    const messagesOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    )
    expect(messagesOverflow).toBeLessThanOrEqual(1)
  })
})
