import { test, expect } from '@playwright/test'
import type { Page, Locator } from '@playwright/test'

/**
 * End-to-end auth flows against the *real* local Supabase stack.
 *
 * The rest of the suite deliberately avoids the live backend; these tests are
 * the exception, because a sign-up confirmation, an unverified sign-in, a
 * logout and a password reset only mean something when GoTrue and the mail
 * catcher are actually running. They assume the stack is up:
 *
 *   supabase start
 *
 * and that email confirmations are on (see supabase/config.toml). The local
 * stack catches the confirmation/reset mail in Mailpit (`127.0.0.1:54324`),
 * which is why these tests can assert the full loop end to end.
 *
 * Every account created here uses a unique address (`@local.test`); mails are
 * left in the shared Mailpit inbox afterwards (a global delete would race the
 * parallel browser projects), and leftover accounts are harmless dev data.
 * The seeded demo member (`demo@local.test`) is used read-only.
 */

const INBUCKET = 'http://127.0.0.1:54324' // Mailpit (the current CLI's mail catcher)
const APP_ORIGIN = 'http://localhost:5173'
const SIGNUP_PASSWORD = 'Valid1!pass-x' // meets the 10-char floor + all classes

interface MailpitMessage {
  ID: string
  To: Array<{ Address?: string }>
  Subject?: string
}

/** Full message body from the per-message endpoint. */
interface MailpitBody {
  Text?: string
  HTML?: string
}

const uniqueEmail = (tag: string) =>
  `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@local.test`

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
  // Settle on the first *visible* heading: the auth layout's decorative
  // (`aria-hidden`, `hidden lg:flex`) marketing <h2> precedes the form's <h1>
  // in DOM order and is display:none on mobile viewports.
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

async function fillSignUp(page: Page, email: string, password: string) {
  await page.getByLabel('Full name').fill('Riley Test')
  await page.getByLabel('Email').fill(email)
  await passwordField(page).fill(password)
  await passwordField(page, 'confirmPassword').fill(password)
  await page.getByLabel('Gender').selectOption('female') // Select renders a <select>
  await page.getByLabel('Date of birth').fill('1992-02-02')
  await page.getByLabel('City').fill('Leeds')
  await page.getByLabel('Country').fill('United Kingdom')
  await page.getByRole('checkbox', { name: 'Women' }).check()
  await page.getByRole('checkbox', { name: 'I am 18 or older' }).check()
  await page.getByRole('checkbox', { name: 'I accept the Terms and Privacy Policy' }).check()
}

/**
 * Creates a member through the real UI and stops at the "check your email"
 * screen. The confirmation is left unopened for the caller to use.
 */
async function signUpNewMember(page: Page, email: string): Promise<void> {
  await gotoAndSettle(page, '/auth/signup')
  await fillSignUp(page, email, SIGNUP_PASSWORD)
  await submitButton(page).click()
  await expect(page).toHaveURL(/\/auth\/verify-email/)
}

async function fetchMailbox(email: string): Promise<MailpitMessage[] | null> {
  // This CLI's Mailpit ignores the `search=` parameter (it returns the whole
  // inbox), so the list is pulled in full and filtered by exact recipient
  // address here. `limit=500` keeps a long dev session from pushing the
  // matching message off the page.
  const res = await fetch(`${INBUCKET}/api/v1/messages?limit=500`)
  if (!res.ok) return null
  const data = (await res.json()) as { messages?: MailpitMessage[] }
  return (data.messages ?? []).filter((message) =>
    (message.To ?? []).some((to) => to.Address === email),
  )
}

/**
 * Finds the first verification/reset URL of the requested kind in Mailpit.
 * The Text part has unescaped URLs; the HTML one uses `&amp;`. Filtering on
 * `type=` (signup vs recovery) stops a stale signup message from shadowing a
 * fresh reset link.
 */
async function mailLink(email: string, type: 'signup' | 'recovery'): Promise<string | null> {
  const messages = await fetchMailbox(email)
  if (!messages || messages.length === 0) return null

  for (const message of messages) {
    const bodyRes = await fetch(`${INBUCKET}/api/v1/message/${message.ID}`)
    if (!bodyRes.ok) continue
    const body = (await bodyRes.json()) as MailpitBody
    const haystack = [body.Text ?? '', body.HTML ?? ''].join('\n')

    const matches = haystack.match(/https?:\/\/[^\s"'<>]+(?:verify|auth\/v1\/verify)[^\s"'<>]*/gi)
    for (const match of matches ?? []) {
      const url = match.replace(/&amp;/g, '&')
      if (url.includes(`type=${type}`)) return url
    }
  }
  return null
}

/**
 * Polls an async probe until it yields a truthy value or the deadline passes.
 * Playwright's `expect.poll` loses the resolved value to its typing, so this
 * returns it directly instead of re-fetching Mailpit a second time.
 */
async function waitFor(
  probe: () => Promise<string | null>,
  { timeout = 30_000, message }: { timeout?: number; message: string },
): Promise<string> {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const found = await probe()
    if (found) return found
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(message)
}

test.describe('Sign-up against the live stack', () => {
  test('a new member confirms by email and lands on onboarding', async ({ page }) => {
    const appErrors = collectAppErrors(page)
    const email = uniqueEmail('happy')

    await signUpNewMember(page, email)
    await expect(page.getByText(email)).toBeVisible()

    const link = await waitFor(() => mailLink(email, 'signup'), {
      timeout: 30_000,
      message: 'the confirmation email never arrived in Mailpit',
    })

    await page.goto(link)

    // PKCE exchange → /auth/callback → app → onboarding (the fresh profile
    // has no bio yet, so the completeness guard sends it there).
    await expect(page).toHaveURL(/\/onboarding$/, { timeout: 20_000 })
    await expect(
      page.getByRole('heading', { name: /finish setting up your profile/i })
    ).toBeVisible()
    expect(appErrors).toEqual([])
  })

  test('an unconfirmed member is blocked at sign-in and offered a resend link', async ({ page }) => {
    const email = uniqueEmail('unverified')

    await signUpNewMember(page, email)
    // The email is deliberately NOT confirmed.

    await page.goto('/auth/login')
    await page.getByLabel('Email').fill(email)
    await passwordField(page).fill(SIGNUP_PASSWORD)
    await submitButton(page).click()

    await expect(page.getByText(/confirm your email address first/i)).toBeVisible()
    await expect(page.getByRole('link', { name: /resend the verification email/i })).toBeVisible()
    // Still on the login form, not in the app.
    await expect(page).toHaveURL(/\/auth\/login$/)
  })
})

test.describe('Sign-in against the live stack', () => {
  test('a wrong password shows the generic message and never the real reason', async ({ page }) => {
    await gotoAndSettle(page, '/auth/login')

    await page.getByLabel('Email').fill(uniqueEmail('ghost'))
    await passwordField(page).fill('Wrong1!pass')
    await submitButton(page).click()

    await expect(
      page.getByText('That email and password combination does not match an account.')
    ).toBeVisible()
    await expect(page.getByText(/invalid login credentials/i)).toHaveCount(0)
    await expect(page).toHaveURL(/\/auth\/login$/)
  })

  test('five failed attempts lock the form for 30 seconds', async ({ page }) => {
    await gotoAndSettle(page, '/auth/login')

    await page.getByLabel('Email').fill(uniqueEmail('bruteforce'))
    await passwordField(page).fill('Wrong1!pass')

    for (let attempt = 0; attempt < 5; attempt++) {
      if (attempt > 0) {
        await expect(page.getByRole('button', { name: /sign in/i })).toBeEnabled()
      }
      await submitButton(page).click()
      await expect(
        page.getByText('That email and password combination does not match an account.')
      ).toBeVisible()
    }

    await expect(page.getByText(/too many failed attempts\. try again in \d+s/i)).toBeVisible()
    await expect(page.getByLabel('Email')).toBeDisabled()
    await expect(passwordField(page)).toBeDisabled()
    await expect(page.getByRole('button', { name: /sign in/i })).toBeDisabled()
  })
})

test.describe('Sessions against the live stack', () => {
  test('the seeded demo member can sign in and sign out', async ({ page }) => {
    await gotoAndSettle(page, '/auth/login')

    await page.getByLabel('Email').fill('demo@local.test')
    await passwordField(page).fill('Demo-Local-2026')
    await submitButton(page).click()

    await expect(page).toHaveURL(/\/app\/discover$/, { timeout: 15_000 })

    // Sign out from the settings screen: reachable at every viewport, whereas
    // the header button is hidden below `lg`.
    await page.goto('/app/settings')
    await expect(page.getByRole('main')).toBeVisible()
    await page.getByRole('main').getByRole('button', { name: /sign out/i }).click()

    await expect(page).toHaveURL(/\/auth\/login$/, { timeout: 15_000 })
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible()
  })
})

test.describe('Password reset against the live stack', () => {
  test('a member recovers their account and signs in with the new password', async ({ page }) => {
    const email = uniqueEmail('reset')
    const password = SIGNUP_PASSWORD
    const newPassword = 'BrandNew-2026-pass'

    // Set up a real, confirmed member first.
    await signUpNewMember(page, email)
    const signupLink = await waitFor(() => mailLink(email, 'signup'), {
      timeout: 30_000,
      message: 'the confirmation email never arrived in Mailpit',
    })
    await page.goto(signupLink)
    await expect(page).toHaveURL(/\/onboarding$/, { timeout: 20_000 })

    // Sign out of that fresh session so the reset flow starts cold.
    await page.goto('/app/settings')
    await page.getByRole('main').getByRole('button', { name: /sign out/i }).click()
    await expect(page).toHaveURL(/\/auth\/login$/, { timeout: 15_000 })

    // Request the reset email.
    await page.goto('/auth/forgot-password')
    await page.getByLabel('Email').fill(email)
    await page.getByRole('button', { name: /send reset link|send/i }).click()
    await expect(page.getByText(/check your inbox/i)).toBeVisible()

    // The fresh recovery mail has already landed (or will any moment).
    const resetLink = await waitFor(() => mailLink(email, 'recovery'), {
      timeout: 30_000,
      message: 'the recovery email never arrived in Mailpit',
    })

    // Open the recovery link: PKCE exchange yields a session, so the reset
    // form renders instead of the "not valid" screen.
    await page.goto(resetLink)
    await expect(
      page.getByRole('heading', { name: /choose a new password/i })
    ).toBeVisible({ timeout: 15_000 })

    await passwordField(page).fill(newPassword)
    await passwordField(page, 'confirmPassword').fill(newPassword)
    await page.getByRole('button', { name: /update password/i }).click()

    await expect(page.getByRole('heading', { name: /password updated/i })).toBeVisible()

    // The new password signs the member in; the old one no longer does.
    await page.getByRole('link', { name: /go to sign in/i }).click()
    await page.getByLabel('Email').fill(email)
    await passwordField(page).fill(password)
    await submitButton(page).click()
    await expect(
      page.getByText('That email and password combination does not match an account.')
    ).toBeVisible()

    await passwordField(page).fill(newPassword)
    await submitButton(page).click()
    await expect(page).toHaveURL(/\/onboarding$/, { timeout: 15_000 })
  })
})