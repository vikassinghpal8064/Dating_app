import { test, expect } from '@playwright/test'

/**
 * Admin panel and verification E2E tests.
 *
 * ORDER NOTE: This file sorts after chat.spec.ts and safety.spec.ts.
 * It requires an admin user to be set up in the database.
 */

const APP_ORIGIN = 'http://localhost:5173'
const ADMIN_EMAIL = 'admin@local.test'
const ADMIN_PASSWORD = 'Admin-Local-2026'
const USER_EMAIL = 'demo@local.test'
const USER_PASSWORD = 'Demo-Local-2026'

test.describe.configure({ mode: 'serial' })

test.describe('Admin panel and verification', () => {
  test('normal user visiting /admin is redirected', async ({ page }) => {
    test.setTimeout(60_000)

    // Login as normal user
    await page.goto(APP_ORIGIN)
    await page.getByLabel('Email').fill(USER_EMAIL)
    await page.getByLabel('Password').fill(USER_PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.waitForURL('**/app/discover')

    // Try to visit /admin
    await page.goto(`${APP_ORIGIN}/admin`)
    await page.waitForLoadState('networkidle')

    // Should be redirected to /app/discover
    await expect(page).toHaveURL(/\/app\/discover/)
  })

  test('admin can access /admin page', async ({ page }) => {
    test.setTimeout(60_000)

    // Login as admin (assuming admin account exists)
    await page.goto(APP_ORIGIN)
    await page.getByLabel('Email').fill(ADMIN_EMAIL)
    await page.getByLabel('Password').fill(ADMIN_PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.waitForURL('**/admin')

    // Should see admin page
    await expect(page.getByRole('heading', { name: /admin/i })).toBeVisible()
    await expect(page.getByText(/administrator/i)).toBeVisible()
  })

  test('admin can view reports tab', async ({ page }) => {
    test.setTimeout(60_000)

    // Login as admin
    await page.goto(APP_ORIGIN)
    await page.getByLabel('Email').fill(ADMIN_EMAIL)
    await page.getByLabel('Password').fill(ADMIN_PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.waitForURL('**/admin')

    // Click on Reports tab
    await page.getByRole('tab', { name: /reports/i }).click()

    // Should see reports queue heading
    await expect(page.getByRole('heading', { name: /reports queue/i })).toBeVisible()
  })

  test('admin can view photos tab', async ({ page }) => {
    test.setTimeout(60_000)

    // Login as admin
    await page.goto(APP_ORIGIN)
    await page.getByLabel('Email').fill(ADMIN_EMAIL)
    await page.getByLabel('Password').fill(ADMIN_PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.waitForURL('**/admin')

    // Click on Photos tab
    await page.getByRole('tab', { name: /photos/i }).click()

    // Should see photo moderation heading
    await expect(page.getByRole('heading', { name: /photo moderation/i })).toBeVisible()
  })

  test('admin can view verification tab', async ({ page }) => {
    test.setTimeout(60_000)

    // Login as admin
    await page.goto(APP_ORIGIN)
    await page.getByLabel('Email').fill(ADMIN_EMAIL)
    await page.getByLabel('Password').fill(ADMIN_PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.waitForURL('**/admin')

    // Click on Verification tab
    await page.getByRole('tab', { name: /verification/i }).click()

    // Should see verification queue heading
    await expect(page.getByRole('heading', { name: /verification queue/i })).toBeVisible()
  })

  test('admin can view users tab', async ({ page }) => {
    test.setTimeout(60_000)

    // Login as admin
    await page.goto(APP_ORIGIN)
    await page.getByLabel('Email').fill(ADMIN_EMAIL)
    await page.getByLabel('Password').fill(ADMIN_PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.waitForURL('**/admin')

    // Click on Users tab
    await page.getByRole('tab', { name: /^users$/i }).click()

    // Should see user management heading
    await expect(page.getByRole('heading', { name: /user management/i })).toBeVisible()

    // Should see search input
    await expect(page.getByPlaceholder(/search by name or email/i)).toBeVisible()
  })

  test('admin can view stats tab', async ({ page }) => {
    test.setTimeout(60_000)

    // Login as admin
    await page.goto(APP_ORIGIN)
    await page.getByLabel('Email').fill(ADMIN_EMAIL)
    await page.getByLabel('Password').fill(ADMIN_PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.waitForURL('**/admin')

    // Click on Stats tab
    await page.getByRole('tab', { name: /stats/i }).click()

    // Should see statistics heading
    await expect(page.getByRole('heading', { name: /statistics/i })).toBeVisible()

    // Should see total users stat
    await expect(page.getByText(/total users/i)).toBeVisible()
  })

  test('normal user can access /verify page', async ({ page }) => {
    test.setTimeout(60_000)

    // Login as normal user
    await page.goto(APP_ORIGIN)
    await page.getByLabel('Email').fill(USER_EMAIL)
    await page.getByLabel('Password').fill(USER_PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.waitForURL('**/app/discover')

    // Navigate to /verify
    await page.goto(`${APP_ORIGIN}/app/verify`)
    await page.waitForLoadState('networkidle')

    // Should see verification page
    await expect(page.getByRole('heading', { name: /profile verification/i })).toBeVisible()
    await expect(page.getByText(/verify your identity/i)).toBeVisible()
  })

  test('normal user can see verification link on /me page', async ({ page }) => {
    test.setTimeout(60_000)

    // Login as normal user
    await page.goto(APP_ORIGIN)
    await page.getByLabel('Email').fill(USER_EMAIL)
    await page.getByLabel('Password').fill(USER_PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.waitForURL('**/app/discover')

    // Navigate to /me
    await page.goto(`${APP_ORIGIN}/app/me`)
    await page.waitForLoadState('networkidle')

    // Should see verification section
    await expect(page.getByRole('heading', { name: /profile verification/i })).toBeVisible()

    // Should see verify now link (if not verified) or verified badge (if verified)
    const verifyLink = page.getByRole('link', { name: /verify now/i })
    const verifiedBadge = page.getByText(/verified/i)
    await expect(verifyLink.or(verifiedBadge)).toBeVisible()
  })

  test('verification page shows pose prompt', async ({ page }) => {
    test.setTimeout(60_000)

    // Login as normal user
    await page.goto(APP_ORIGIN)
    await page.getByLabel('Email').fill(USER_EMAIL)
    await page.getByLabel('Password').fill(USER_PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.waitForURL('**/app/discover')

    // Navigate to /verify
    await page.goto(`${APP_ORIGIN}/app/verify`)
    await page.waitForLoadState('networkidle')

    // Should see pose prompt
    await expect(page.getByText(/please follow this instruction/i)).toBeVisible()
  })
})
