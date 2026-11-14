import { test, expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { crc32, deflateSync } from 'node:zlib'

/**
 * End-to-end onboarding against the *real* local Supabase stack.
 *
 * Same ground rules as auth-flow.spec.ts: the stack and its mail catcher must
 * be running (`supabase start`), every member uses a unique `@local.test`
 * address, and the wizard is driven through the actual UI from a fresh
 * confirmed sign-up to the Discovery surface.
 *
 * What this file proves beyond the unit tests:
 *  - the eight-step wizard is walkable end to end, with live validation,
 *  - a renamed `.exe` (MZ header, `photo.jpg` name) is rejected and the
 *    rejection is *shown* to the member through the step's alert,
 *  - an uploaded image comes back from storage as WebP without any trace of
 *    the source-file marker bytes, i.e. the canvas round-trip stripped the
 *    EXIF/GPS payload rather than passing the original object through,
 *  - the WhatsApp number is stored only in `private_contacts` as E.164 with
 *    the chosen share mode, and `profiles` (readable via the REST API) has no
 *    phone/WhatsApp column at all,
 *  - "Use my current area" stores coordinates rounded to exactly two decimal
 *    places, as the database CHECK demands.
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
 * Finds the first verification URL of the requested kind in Mailpit.
 * The Text part has unescaped URLs; the HTML one uses `&amp;`. Filtering on
 * `type=` stops a stale signup message from shadowing a fresh link.
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

/** Signs up a fresh member and confirms the email, landing on `/onboarding`. */
async function confirmAndReachOnboarding(page: Page, tag: string): Promise<string> {
  const email = uniqueEmail(tag)
  await signUpNewMember(page, email)
  const link = await waitFor(() => mailLink(email, 'signup'), {
    timeout: 30_000,
    message: 'the confirmation email never arrived in Mailpit',
  })
  await page.goto(link)
  // PKCE exchange → /auth/callback → app → onboarding.
  await expect(page).toHaveURL(/\/onboarding$/, { timeout: 20_000 })
  await expect(
    page.getByRole('heading', { name: /finish setting up your profile/i }),
  ).toBeVisible()
  return email
}

/** The wizard's primary action; the last step rounds to "Finish". */
function continueButton(page: Page): Locator {
  return page.getByRole('button', { name: /^(continue|finish)$/i })
}

/** Steps the wizard forward and waits for the next step's heading. */
async function walkTo(page: Page, heading: RegExp) {
  await continueButton(page).click()
  await expect(page.getByRole('heading', { name: heading })).toBeVisible()
  await expect(page.locator('[role="progressbar"]')).toBeVisible()
}

/**
 * Builds a valid 1×1 RGB PNG with a `tEXt` chunk carrying `marker` bytes.
 * PNG decoders ignore ancillary chunks, so the file still decodes, while the
 * marker lets the test prove the *stored* object is not the source bytes.
 */
function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const typeAndData = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(typeAndData), 0)
  return Buffer.concat([length, typeAndData, checksum])
}

function tinyPngWithMarker(marker: string): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(1, 0) // width
  ihdr.writeUInt32BE(1, 4) // height
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // colour type: RGB
  const scanline = Buffer.from([0, 200, 40, 40]) // filter None + one RGB pixel
  const idat = deflateSync(scanline)
  const textData = Buffer.concat([Buffer.from('Comment\0', 'latin1'), Buffer.from(marker, 'latin1')])
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('tEXt', textData),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

/**
 * Reads the public Supabase configuration the build under test was bundled
 * with. The preview server serves the production build, and Vite's env
 * precedence is `.env` overridden by `.env.local` (mode-specific files do not
 * exist in this repo). A missing `.env.local` is fine — the base `.env` then
 * stands alone, exactly as it does for the build.
 */
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

/**
 * Reads the member's session token from the page and issues a REST query
 * against the *same* Supabase project the app talks to (RLS filters to own
 * rows). The base URL and anon key come from the env layers that actually
 * shaped the build (see `readSupabaseConfig`), so the assertions never leak to
 * a different environment than the one under test.
 */
async function memberRest(page: Page, table: string): Promise<Record<string, unknown>[]> {
  const { url, anonKey } = readSupabaseConfig()
  const rows = await page.evaluate(
    async ({ base, key, tableName }) => {
      // supabase-js persists the session under `sb-<host-label>-auth-token`
      // (the SDK overrides its own `supabase.auth.token` default); accept
      // either form so the lookup survives storage-key evolution.
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

test.describe('Onboarding wizard against the live stack', () => {
  test('a member walks all eight steps, uploads photos, and lands on Discovery', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const appErrors = collectAppErrors(page)
    await confirmAndReachOnboarding(page, 'onboard')

    // Step 1 — Basics (pre-filled by the sign-up form).
    await expect(page.getByText('Step 1 of 8')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'The basics' })).toBeVisible()
    await expect(page.locator('#basics-full-name')).toHaveValue('Riley Test')
    await expect(page.locator('#basics-dob')).toHaveValue('1992-02-02')
    await walkTo(page, /your location/i)

    // Step 2 — Location (city/country carried over from sign-up).
    await expect(page.locator('#location-city')).toHaveValue('Leeds')
    await expect(page.locator('#location-country')).toHaveValue('United Kingdom')
    await walkTo(page, /about you/i)

    // Step 3 — About: bio, height, education, occupation, one language.
    await page.locator('#about-bio').fill(
      'Hiker and pasta enthusiast. I read more poetry than my bookshelf admits and run '
        + 'half-marathons once a year, usually in the rain.',
    )
    await page.locator('#about-height').selectOption('172')
    await page.locator('#about-education').fill('BA Photography')
    await page.locator('#about-occupation').fill('Documentary photographer')
    await page.locator('#about-languages').fill('English')
    await page.getByRole('button', { name: /add .english./i }).click()
    await expect(page.getByRole('list', { name: 'Selected languages' })).toContainText('English')
    await walkTo(page, /your interests/i)

    // Step 4 — Interests: five chips unlock the step.
    const interests = page.getByRole('group', { name: 'Interests' })
    for (const interest of ['books', 'coffee', 'hiking', 'travel', 'yoga']) {
      await interests.getByRole('button', { name: interest, exact: true }).click()
    }
    await expect(interests.getByText('ready to continue')).toBeVisible()
    await walkTo(page, /what are you looking for\?/i)

    // Step 5 — Looking for. The option cards embed a description, so match the
    // accessible name by substring rather than exact text.
    await page.getByRole('button', { name: /a serious relationship/i }).click()
    await walkTo(page, /your photos/i)

    // Step 6 — Photos.
    const marker = 'EXIF-GPS-STRIP-PROOF'
    const fileInput = page.locator('input[aria-label="Add photos"]')

    // A renamed executable is rejected and the member is told so.
    await fileInput.setInputFiles({
      name: 'photo.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('MZ\u0000\u0001this is not a jpeg at all', 'latin1'),
    })
    await expect(page.getByRole('alert')).toContainText('not a real photo')
    await expect(page.getByText(/Add at least 2 more photos/)).toBeVisible()

    // Two genuine images upload (first carries the marker inside its bytes).
    await fileInput.setInputFiles([
      { name: 'one.png', mimeType: 'image/png', buffer: tinyPngWithMarker(marker) },
      { name: 'two.png', mimeType: 'image/png', buffer: tinyPngWithMarker('just-another-png') },
    ])
    const tiles = page.locator('ul[aria-label="Your photos"] li')
    await expect(tiles).toHaveCount(2, { timeout: 30_000 })
    await expect(page.getByText('2 of 6 photos')).toBeVisible()

    // The stored object is a canvas re-encode — WebP on engines that can
    // encode it, JPEG on WebKit which cannot — and contains none of the marker
    // bytes that the source PNG carried: EXIF/GPS was stripped, not passed
    // through. Both signatures prove the re-encode happened.
    const signedUrl = await tiles.first().locator('img').getAttribute('src')
    expect(signedUrl).toBeTruthy()
    const stored = await (await page.request.get(signedUrl!)).body()
    const isWebp = stored.subarray(0, 4).toString('latin1') === 'RIFF'
      && stored.subarray(8, 12).toString('latin1') === 'WEBP'
    const isJpeg = stored[0] === 0xff && stored[1] === 0xd8 && stored[2] === 0xff
    expect(isWebp || isJpeg).toBe(true)
    expect(stored.includes(Buffer.from(marker, 'latin1'))).toBe(false)

    await walkTo(page, /your contact preference/i)

    // Step 7 — Contact: consents, then shares a number with approved-only.
    // The consent control is a visual toggle: the checkbox is sr-only and the
    // label draws the switch, so click the label like a real user would.
    await page.locator('label', { hasText: 'Share my WhatsApp number with matches' }).click()
    await page.getByLabel('WhatsApp number', { exact: true }).fill('+91 98765 43210')
    await page.locator('#contact-share-mode').selectOption('approved')
    await walkTo(page, /review before you start/i)

    // Step 8 — Review, then finish into the app.
    await expect(page.getByText('Step 8 of 8')).toBeVisible()
    await expect(page.getByText('Almost there')).toBeVisible()
    await expect(page.getByText('WhatsApp shared with approved-only')).toBeVisible()
    await continueButton(page).click()
    await expect(page).toHaveURL(/\/app\/discover$/, { timeout: 20_000 })

    // The REST API sees the E.164 number in private_contacts only; the
    // profiles table has no phone/WhatsApp number column at all (its consent
    // flag is a boolean, never the number itself).
    const [profile] = await memberRest(page, 'profiles')
    const profileKeys = Object.keys(profile)
    expect(profileKeys).not.toContain('phone')
    expect(profileKeys).not.toContain('phone_number')
    expect(profileKeys).not.toContain('whatsapp_number')
    expect(profile.whatsapp_consent).toBe(true)
    const [contact] = await memberRest(page, 'private_contacts')
    expect(contact?.whatsapp_number).toBe('+919876543210')
    expect(contact?.share_mode).toBe('approved')

    // Revisiting onboarding shows the completed state, not the wizard.
    await page.goto('/onboarding')
    await expect(page).toHaveURL(/\/onboarding$/, { timeout: 15_000 })
    await expect(
      page.getByRole('heading', { name: /your profile is complete/i }),
    ).toBeVisible({ timeout: 15_000 })

    expect(appErrors).toEqual([])
  })

  test('the current area is stored rounded to exactly two decimals', async ({ page }) => {
    test.setTimeout(90_000)
    const appErrors = collectAppErrors(page)
    await confirmAndReachOnboarding(page, 'geo')

    // Emulate a GPS fix on the app's origin, then walk to the location step.
    await page.context().grantPermissions(['geolocation'], { origin: APP_ORIGIN })
    await page.context().setGeolocation({ latitude: 19.07654321, longitude: 72.87765432 })
    await expect(page.getByText('Step 1 of 8')).toBeVisible()
    await walkTo(page, /your location/i)

    await page.getByRole('button', { name: /use my current area/i }).click()
    await expect(page.getByText('Current area set.')).toBeVisible({ timeout: 20_000 })

    // The stored coordinates equal the emulated fix rounded to two decimals —
    // the same rounding the profiles CHECK enforces. The write is async, so
    // the assertion polls until the row reflects the change.
    await expect
      .poll(async () => (await memberRest(page, 'profiles'))[0]?.latitude, {
        timeout: 20_000,
      })
      .toBe(19.08)
    const [geoProfile] = await memberRest(page, 'profiles')
    expect(geoProfile.latitude).toBe(19.08)
    expect(geoProfile.longitude).toBe(72.88)

    expect(appErrors).toEqual([])
  })
})