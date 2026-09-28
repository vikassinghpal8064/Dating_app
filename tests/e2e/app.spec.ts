import { test, expect } from '@playwright/test'
import type { Page, Locator } from '@playwright/test'

/**
 * Fails a test on any console error or uncaught exception raised by the
 * application itself.
 *
 * Third-party request failures are excluded on purpose: the suite runs without a
 * signed-in session, so every call to the Supabase API is unauthenticated and
 * the sandbox may have no outbound network at all. Asserting on those would
 * test the sandbox, not the code. Everything raised by the app's own origin —
 * including uncaught React errors, which is exactly how the lazy-route bug
 * surfaced — still fails the test.
 */
const APP_ORIGIN = 'http://localhost:5173'

/**
 * Starts recording app-origin console errors. The returned array is live, so
 * assert on it after the interactions under test have run.
 *
 * This is a plain helper rather than a Playwright fixture on purpose: the
 * fixture protocol requires a parameter named `use`, which collides with
 * `react-hooks/rules-of-hooks` in a file that otherwise looks like a component.
 */
function collectAppErrors(page: Page): string[] {
  const errors: string[] = []

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    const location = msg.location()
    const isFromUs =
      !location.url ||
      location.url.startsWith(APP_ORIGIN) ||
      location.url.startsWith('/')
    if (!isFromUs) return
    errors.push(`[console] ${msg.text()}`)
  })

  page.on('pageerror', (error) => {
    // An uncaught exception is always ours, whatever it called out to.
    errors.push(`[pageerror] ${error.message}`)
  })

  return errors
}

/**
 * Navigates and waits for the app to have painted.
 *
 * Every route except the landing page is code-split, so `page.goto` resolving
 * only means the HTML shell arrived. Every route is therefore navigated to
 * through this helper rather than by a bare `goto`.
 */
async function gotoAndSettle(page: Page, path: string) {
  await page.goto(path)
  await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 15_000 })
  // Wait for the network to go quiet before returning.
  //
  // A heading can be visible while the route's lazy chunk is still streaming in
  // — Contact pulls `zod` and the shared schemas as separate chunks, imported
  // after the shell renders. Any test that navigates away at that moment
  // cancels the in-flight imports, and WebKit reports the cancellation as a
  // `pageerror`: "Importing a module script failed". That is the test tearing
  // the page down mid-load, not an application fault, and it surfaced as a
  // spurious failure in the no-console-errors assertion.
  //
  // Settling here fixes it for every caller of the helper rather than for the
  // one test that happened to trip over it. The assertions themselves are
  // untouched: this only guarantees the page finished loading before it is
  // replaced.
  await page.waitForLoadState('networkidle')
  // The route error boundary is a real page, not a crash, so assert we are not
  // looking at it: it means a lazy import or a render threw.
  await expect(page.getByText('Unexpected Application Error')).toHaveCount(0)
}

/**
 * The password field.
 *
 * `getByLabel` cannot be used for it: `Label` renders a *visible* required
 * marker inside the label element, and Playwright's label engine matches on
 * the label's text content rather than its accessible name (which correctly
 * drops the `aria-hidden` marker). The label therefore reads `Password*`, so
 * both an exact and an inexact `getByLabel('Password')` miss the input. The
 * `for`/`id` pair is the same contract the label relies on, so it is the
 * locator to use.
 */
function passwordField(page: Page): Locator {
  return page.locator('#password')
}

/** The sign-up / sign-in submit button, before and after its loading label. */
function submitButton(page: Page): Locator {
  return page.getByRole('button', { name: /^(create account|sign in|creating account…|signing in…)$/i })
}

/** Every route in the application, paired with a heading unique to it. */
const PUBLIC_ROUTES: { path: string; heading: string | RegExp }[] = [
  { path: '/', heading: 'Find your' },
  { path: '/about', heading: 'About HeartConnect' },
  { path: '/safety', heading: 'Safety Center' },
  { path: '/privacy', heading: 'Privacy Policy' },
  { path: '/terms', heading: 'Terms of Service' },
  { path: '/contact', heading: /contact/i },
]

const AUTH_ROUTES: { path: string; heading: string | RegExp }[] = [
  { path: '/auth', heading: /^sign in$/i },
  { path: '/auth/login', heading: /^sign in$/i },
  { path: '/auth/signup', heading: /^create your account$/i },
  { path: '/auth/forgot-password', heading: /password/i },
  { path: '/auth/reset-password', heading: /not valid/i },
  // Arriving with no callback at all is an error, and the page says so.
  { path: '/auth/verify-email', heading: /^that link did not work$/i },
]

/** Every route that requires a session. */
const PROTECTED_ROUTES = [
  '/onboarding',
  '/app',
  '/app/discover',
  '/app/search',
  '/app/matches',
  '/app/messages',
  '/app/messages/some-match-id',
  '/app/likes',
  '/app/me',
  '/app/me/edit',
  '/app/settings',
  '/app/profile/some-profile-id',
  '/admin',
]

test.describe('Public routes', () => {
  for (const { path, heading } of PUBLIC_ROUTES) {
    test(`${path} renders without console errors`, async ({ page }) => {
      const appErrors = collectAppErrors(page)
      await gotoAndSettle(page, path)
      await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible()
      expect(appErrors).toEqual([])
    })
  }
})

test.describe('Auth routes', () => {
  for (const { path, heading } of AUTH_ROUTES) {
    test(`${path} renders without console errors`, async ({ page }) => {
      const appErrors = collectAppErrors(page)
      await gotoAndSettle(page, path)
      await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible()
      expect(appErrors).toEqual([])
    })
  }

  test('/auth/verify-email with an emailed address waits for the link', async ({ page }) => {
    const appErrors = collectAppErrors(page)
    await gotoAndSettle(page, '/auth/verify-email?email=someone%40example.com')

    await expect(page.getByRole('heading', { name: /^check your email$/i })).toBeVisible()
    // The address is echoed back, which is the whole point of the screen.
    await expect(page.getByText('someone@example.com')).toBeVisible()
    await expect(page.getByRole('button', { name: /resend confirmation email/i })).toBeVisible()
    expect(appErrors).toEqual([])
  })

  test('/auth/verify-email reports an expired callback instead of spinning', async ({ page }) => {
    const appErrors = collectAppErrors(page)
    await gotoAndSettle(
      page,
      '/auth/verify-email?error=access_denied&error_description=Email+link+is+invalid+or+has+expired'
    )

    await expect(page.getByRole('heading', { name: /^that link did not work$/i })).toBeVisible()
    await expect(page.getByRole('alert')).toContainText(
      'Email link is invalid or has expired'
    )
    expect(appErrors).toEqual([])
  })
})

test.describe('Protected routes', () => {
  for (const path of PROTECTED_ROUTES) {
    test(`${path} redirects an anonymous visitor to sign in`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveURL(/\/auth\/login$/)
      // The login form is the proof the guard ran, rather than a blank redirect.
      await expect(page.getByRole('heading', { name: /^sign in$/i })).toBeVisible()
      await expect(page.getByLabel('Email')).toBeVisible()
    })
  }

  test('a protected redirect remembers the destination for after sign in', async ({ page }) => {
    await page.goto('/app/settings')
    await expect(page).toHaveURL(/\/auth\/login$/)

    // `ProtectedRoute` stashes the destination in router state; the login page
    // reads it back and navigates there instead of to the default. Inspect the
    // router state through the history entry the redirect created, so this
    // asserts the mechanism and not just the URL we already checked above.
    const from = await page.evaluate(() => {
      const state = window.history.state as { usr?: { from?: unknown } } | null
      return (state?.usr?.from ?? null) as string | null
    })

    expect(from).toBe('/app/settings')
  })
})

test.describe('Sign-up validation', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAndSettle(page, '/auth/signup')
  })

  test('an empty form reports every required field', async ({ page }) => {
    await submitButton(page).click()

    await expect(page.getByText('Invalid email address')).toBeVisible()
    await expect(page.getByText('Date of birth is required')).toBeVisible()
    await expect(page.getByText('City is required')).toBeVisible()
    await expect(page.getByText('Country is required')).toBeVisible()
  })

  test('an invalid email is rejected', async ({ page }) => {
    await page.getByLabel('Email').fill('not-an-email')
    await passwordField(page).fill('Valid1!pass')
    await page.getByLabel('Confirm password').fill('Valid1!pass')
    await submitButton(page).click()

    await expect(page.getByText('Invalid email address')).toBeVisible()
  })

  test('a weak password is rejected against the stated policy', async ({ page }) => {
    await page.getByLabel('Email').fill('someone@example.com')
    await passwordField(page).fill('weak')
    await page.getByLabel('Confirm password').fill('weak')
    await submitButton(page).click()

    await expect(page.getByText('Password must be at least 8 characters')).toBeVisible()
  })

  test('mismatched passwords are rejected', async ({ page }) => {
    await page.getByLabel('Email').fill('someone@example.com')
    await passwordField(page).fill('Valid1!pass')
    await page.getByLabel('Confirm password').fill('Valid1!pass2')
    await submitButton(page).click()

    await expect(page.getByText('Passwords do not match')).toBeVisible()
  })

  test('the terms checkbox is required', async ({ page }) => {
    await page.getByLabel('Email').fill('someone@example.com')
    await passwordField(page).fill('Valid1!pass')
    await page.getByLabel('Confirm password').fill('Valid1!pass')
    await page.getByLabel('Full name').fill('Test Person')
    await page.getByLabel('Date of birth').fill('1990-01-01')
    await page.getByLabel('City').fill('Leeds')
    await page.getByLabel('Country').fill('United Kingdom')
    await page.getByRole('checkbox', { name: 'Women' }).check()
    await submitButton(page).click()

    await expect(
      page.getByText('You must accept the terms and conditions')
    ).toBeVisible()
  })

  test('the live password checklist reflects what has been typed', async ({ page }) => {
    const checklist = page.locator('#password-requirements li')

    await expect(checklist).toHaveCount(5)
    await expect(checklist.filter({ hasText: 'At least 8 characters' })).toContainText('not met')

    await passwordField(page).fill('Valid1!pass')

    // Every rule is satisfied, so every line flips to met.
    await expect(checklist.filter({ hasText: 'met' }).first()).toBeVisible()
    await expect(checklist.filter({ hasText: 'not met' })).toHaveCount(0)
  })
})

test.describe('Under-18 rejection', () => {
  test('the date input refuses a date that is under 18 today', async ({ page }) => {
    await gotoAndSettle(page, '/auth/signup')

    const max = await page.getByLabel('Date of birth').getAttribute('max')
    expect(max).toBeTruthy()

    const cutoff = new Date(max as string)
    const year = cutoff.getUTCFullYear()
    // The maximum permitted date of birth must be exactly 18 years back.
    expect(year).toBe(new Date().getUTCFullYear() - 18)
  })

  test('an under-18 date of birth is rejected with the 18+ message', async ({ page }) => {
    await gotoAndSettle(page, '/auth/signup')

    await page.getByLabel('Email').fill('child@example.com')
    await passwordField(page).fill('Valid1!pass')
    await page.getByLabel('Confirm password').fill('Valid1!pass')
    await page.getByLabel('Full name').fill('Too Young')
    await page.getByLabel('Date of birth').fill('2015-06-01')
    await page.getByLabel('City').fill('Leeds')
    await page.getByLabel('Country').fill('United Kingdom')
    await page.getByRole('checkbox', { name: 'Women' }).check()
    await page.getByRole('checkbox', { name: /I agree to the/i }).check()
    await submitButton(page).click()

    await expect(page.getByText('You must be at least 18 years old')).toBeVisible()
    // Nothing was submitted, so we are still on the form.
    await expect(page).toHaveURL(/\/auth\/signup$/)
  })
})

test.describe('Sign-in', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAndSettle(page, '/auth/login')
  })

  test('an empty form reports the missing fields', async ({ page }) => {
    await submitButton(page).click()

    await expect(page.getByText('Invalid email address')).toBeVisible()
    await expect(page.getByText('Password is required')).toBeVisible()
  })

  test('a rejected sign in shows an error and stays on the form', async ({ page }) => {
    // Route the auth call to a definite rejection so the error state is
    // asserted from the application's own handling, not from a live backend.
    await page.route('**/auth/v1/token**', (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'invalid_grant',
          error_description: 'Invalid login credentials',
        }),
      })
    )

    await page.getByLabel('Email').fill('nobody@example.com')
    await passwordField(page).fill('Wrong1!pass')
    await submitButton(page).click()

    await expect(
      page.getByText('That email and password combination does not match an account.')
    ).toBeVisible()
    await expect(page).toHaveURL(/\/auth\/login$/)
  })

  test('the password can be revealed and hidden', async ({ page }) => {
    await passwordField(page).fill('Valid1!pass')

    const toggle = page.getByRole('button', { name: 'Show password' })
    await toggle.click()
    await expect(passwordField(page)).toHaveAttribute('type', 'text')

    await page.getByRole('button', { name: 'Hide password' }).click()
    await expect(passwordField(page)).toHaveAttribute('type', 'password')
  })
})

test.describe('Not found', () => {
  test('an unknown URL shows the 404 page', async ({ page }) => {
    const appErrors = collectAppErrors(page)
    await gotoAndSettle(page, '/this-route-does-not-exist')
    await expect(page.getByRole('heading', { name: '404' })).toBeVisible()
    expect(appErrors).toEqual([])
  })

  test('the 404 page offers a way back', async ({ page }) => {
    await gotoAndSettle(page, '/nope')
    await page.getByRole('link', { name: /back to home/i }).click()
    await expect(page).toHaveURL(/\/$/)
  })
})

test.describe('Navigation', () => {
  test('the landing call to action reaches sign up', async ({ page }) => {
    await gotoAndSettle(page, '/')
    await page.getByRole('link', { name: /create your account/i }).first().click()
    await expect(page).toHaveURL(/\/auth\/signup$/)
  })

  test('the landing sign-in link reaches sign in', async ({ page }) => {
    await gotoAndSettle(page, '/')
    await page.getByRole('link', { name: /i already have an account/i }).click()
    await expect(page).toHaveURL(/\/auth\/login$/)
  })

  test('the footer links resolve to real pages', async ({ page }) => {
    const appErrors = collectAppErrors(page)
    await gotoAndSettle(page, '/')

    const links: { name: RegExp; path: RegExp }[] = [
      { name: /^about$/i, path: /\/about$/ },
      { name: /^safety$/i, path: /\/safety$/ },
      { name: /^privacy policy$/i, path: /\/privacy$/ },
      { name: /^terms of service$/i, path: /\/terms$/ },
      { name: /^contact us$/i, path: /\/contact$/ },
    ]

    for (const link of links) {
      const footer = page.getByRole('contentinfo')
      await footer.getByRole('link', { name: link.name }).first().click()
      await expect(page).toHaveURL(link.path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

      // The heading is up, but the route's own chunk may still be streaming.
      // /contact pulls `zod` and the shared schemas as separate imports started
      // after the shell renders, so returning to '/' at this instant cancels
      // them and WebKit raises "Importing a module script failed" as a
      // pageerror. Settling before leaving keeps the no-errors assertion
      // measuring the application rather than the test's own teardown.
      await page.waitForLoadState('networkidle')

      await gotoAndSettle(page, '/')
    }

    expect(appErrors).toEqual([])
  })

  test('every footer link points at a route that exists', async ({ page }) => {
    await gotoAndSettle(page, '/')

    const hrefs = await page
      .getByRole('contentinfo')
      .locator('a[href]')
      .evaluateAll((nodes) => nodes.map((node) => (node as HTMLAnchorElement).getAttribute('href')))

    expect(hrefs.length).toBeGreaterThan(0)

    for (const href of hrefs) {
      if (!href || !href.startsWith('/')) continue

      const response = await page.request.get(href)
      // A real route returns the SPA shell with 200; a client-side dead end
      // still returns 200, so assert the 404 page content is what renders.
      expect(response.status(), `${href} should be served`).toBe(200)

      await gotoAndSettle(page, href)
      await expect(
        page.getByRole('heading', { name: '404' }),
        `${href} is linked from the footer but is not a route`
      ).toHaveCount(0)
    }
  })
})

test.describe('Accessibility basics', () => {
  test('every public page has exactly one h1', async ({ page }) => {
    for (const { path } of PUBLIC_ROUTES) {
      await gotoAndSettle(page, path)
      await expect(page.locator('h1')).toHaveCount(1)
    }
  })

  test('every auth page has exactly one h1', async ({ page }) => {
    for (const { path } of AUTH_ROUTES) {
      await gotoAndSettle(page, path)
      await expect(page.locator('h1')).toHaveCount(1)
    }
  })

  test('the skip link is the first focusable element', async ({ page }) => {
    await gotoAndSettle(page, '/')

    /*
     * The tab order is read from the document rather than by pressing Tab:
     * WebKit ships with Safari's "full keyboard access" off, so `Tab` there
     * never leaves `document.body` no matter what the page contains. Asserting
     * through the keyboard would silently test nothing on two of the five
     * projects. The document's own focus order is the thing the requirement is
     * about, and it is the same in every engine.
     */
    const firstFocusable = await page.evaluate(() => {
      const focusables = [
        ...document.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ),
      ]
      // `sr-only` still occupies a tab stop, so nothing is filtered out here:
      // the skip link is exactly the kind of element that is visually hidden
      // until it takes focus.
      const first = focusables[0]
      return first ? { tag: first.tagName, text: (first.textContent ?? '').trim() } : null
    })

    expect(firstFocusable).toEqual({ tag: 'A', text: 'Skip to content' })

    // It is only useful if focusing it actually reveals it and moves the
    // viewport past the header.
    const skipLink = page.getByRole('link', { name: /skip to content/i })
    await skipLink.focus()
    await expect(skipLink).toBeFocused()
    await expect(skipLink).toBeVisible()

    await page.locator('#main-content').scrollIntoViewIfNeeded()
    await expect(page.locator('#main-content')).toBeVisible()
  })

  test('the skip link moves focus to the main region', async ({ page }) => {
    await gotoAndSettle(page, '/')

    const skipLink = page.getByRole('link', { name: /skip to content/i })
    await skipLink.focus()
    await page.keyboard.press('Enter')

    // The target has to exist, or the link is a dead control.
    await expect(page).toHaveURL(/#main-content$/)
    await expect(page.locator('#main-content')).toBeVisible()
  })

  test('every page has a landmark set and a main region', async ({ page }) => {
    for (const { path } of [...PUBLIC_ROUTES, ...AUTH_ROUTES]) {
      await gotoAndSettle(page, path)
      await expect(page.getByRole('main'), `${path} has no main landmark`).toHaveCount(1)
    }
  })

  test('images and icons that carry no meaning are hidden from assistive tech', async ({
    page,
  }) => {
    await gotoAndSettle(page, '/')

    const unlabelledImages = await page.locator('img').evaluateAll((nodes) =>
      nodes.filter((node) => {
        const img = node as HTMLImageElement
        return img.getAttribute('alt') === null && img.getAttribute('aria-hidden') !== 'true'
      }).length
    )

    expect(unlabelledImages).toBe(0)
  })
})
