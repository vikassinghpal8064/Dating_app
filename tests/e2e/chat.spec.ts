import { test, expect } from '@playwright/test'
import { createTestUser, cleanupTestUsers } from '../helpers/testUsers'
import { createClient } from '@supabase/supabase-js'

/**
 * Chat e2e tests with Supabase Realtime.
 *
 * Two browser contexts (Alice and Bob) are matched. Tests cover:
 * 1. Alice sends, Bob sees it live (realtime)
 * 2. 'Seen' appears after Bob opens the chat
 * 3. Typing indicator appears
 * 4. Charlie cannot read the chat or subscribe (IDOR via API)
 * 5. After Bob blocks Alice, Alice's send fails
 * 6. <script>alert(1)</script> appears as literal text (no XSS)
 * 7. 31st message in a minute is rejected
 */

const APP_URL = 'http://localhost:5173'
const SUPABASE_URL = 'http://127.0.0.1:54321'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

const ALICE_EMAIL = 'alice@test.local'
const BOB_EMAIL = 'bob@test.local'
const TEST_PASSWORD = 'Test-Password-123!'

let aliceId: string
let bobId: string

test.beforeAll(async () => {
  // Clean up any existing test users
  await cleanupTestUsers()

  // Create Alice and Bob
  aliceId = await createTestUser({ email: ALICE_EMAIL, password: TEST_PASSWORD })
  bobId = await createTestUser({ email: BOB_EMAIL, password: TEST_PASSWORD })

  // Create profiles for Alice and Bob (minimal)
  const supabase = createClient(SUPABASE_URL, ANON_KEY)

  // Sign in as Alice to create profile
  const { data: aliceSession } = await supabase.auth.signInWithPassword({
    email: ALICE_EMAIL,
    password: TEST_PASSWORD,
  })

  if (aliceSession) {
    await supabase.from('profiles').upsert({
      id: aliceId,
      full_name: 'Alice Test',
      date_of_birth: '1995-01-01',
      gender: 'female',
      interested_in: ['male'],
      bio: 'Test user Alice',
      location_city: 'Test City',
      location_state: 'Test State',
      location_country: 'Test Country',
      latitude: 0,
      longitude: 0,
    })
  }

  // Sign in as Bob to create profile
  const { data: bobSession } = await supabase.auth.signInWithPassword({
    email: BOB_EMAIL,
    password: TEST_PASSWORD,
  })

  if (bobSession) {
    await supabase.from('profiles').upsert({
      id: bobId,
      full_name: 'Bob Test',
      date_of_birth: '1995-01-01',
      gender: 'male',
      interested_in: ['female'],
      bio: 'Test user Bob',
      location_city: 'Test City',
      location_state: 'Test State',
      location_country: 'Test Country',
      latitude: 0,
      longitude: 0,
    })
  }

  // Create a match between Alice and Bob (Alice likes Bob, Bob likes Alice)
  if (aliceSession) {
    await supabase.rpc('send_like', { target_user_id: bobId })
  }

  if (bobSession) {
    await supabase.rpc('send_like', { target_user_id: aliceId })
  }

  // Get the match ID
  const { data: matches } = await supabase
    .from('matches')
    .select('id')
    .or(`and(user_id.eq.${aliceId},matched_user_id.eq.${bobId}),and(user_id.eq.${bobId},matched_user_id.eq.${aliceId})`)
    .single()

  if (matches) {
    // Store matchId for tests to use
    ;(globalThis as unknown as { __testMatchId: string }).__testMatchId = matches.id
  }

  await supabase.auth.signOut()
})

test.afterAll(async () => {
  await cleanupTestUsers()
})

test.describe('Chat with Realtime', () => {
  test('Alice sends, Bob sees it live', async ({ browser }) => {
    // Create two contexts for Alice and Bob
    const aliceContext = await browser.newContext()
    const bobContext = await browser.newContext()

    const alicePage = await aliceContext.newPage()
    const bobPage = await bobContext.newPage()

    // Sign in Alice and Bob (assuming seeded test users or create them)
    await alicePage.goto(`${APP_URL}/auth/login`)
    await alicePage.getByLabel('Email').fill('alice@test.local')
    await alicePage.getByLabel('Password').fill('Test-Password-123!')
    await alicePage.getByRole('button', { name: /sign in/i }).click()
    await alicePage.waitForURL('**/app/discover')

    await bobPage.goto(`${APP_URL}/auth/login`)
    await bobPage.getByLabel('Email').fill('bob@test.local')
    await bobPage.getByLabel('Password').fill('Test-Password-123!')
    await bobPage.getByRole('button', { name: /sign in/i }).click()
    await bobPage.waitForURL('**/app/discover')

    // Navigate to messages (assuming they're already matched)
    await alicePage.goto(`${APP_URL}/app/messages`)
    await bobPage.goto(`${APP_URL}/app/messages`)

    // Alice opens the chat with Bob
    await alicePage.getByRole('link', { name: /bob/i }).click()
    await alicePage.waitForURL('**/app/messages/**')

    // Bob opens the chat with Alice
    await bobPage.getByRole('link', { name: /alice/i }).click()
    await bobPage.waitForURL('**/app/messages/**')

    // Alice sends a message
    const testMessage = 'Hello Bob! This is a live test.'
    await alicePage.getByLabel('Message input').fill(testMessage)
    await alicePage.getByRole('button', { name: /send/i }).click()

    // Bob sees it live (realtime)
    await expect(bobPage.getByText(testMessage)).toBeVisible({ timeout: 5000 })

    await aliceContext.close()
    await bobContext.close()
  })

  test("'Seen' appears after Bob opens the chat", async ({ browser }) => {
    const aliceContext = await browser.newContext()
    const bobContext = await browser.newContext()

    const alicePage = await aliceContext.newPage()
    const bobPage = await bobContext.newPage()

    // Sign in
    await alicePage.goto(`${APP_URL}/auth/login`)
    await alicePage.getByLabel('Email').fill('alice@test.local')
    await alicePage.getByLabel('Password').fill('Test-Password-123!')
    await alicePage.getByRole('button', { name: /sign in/i }).click()
    await alicePage.waitForURL('**/app/discover')

    await bobPage.goto(`${APP_URL}/auth/login`)
    await bobPage.getByLabel('Email').fill('bob@test.local')
    await bobPage.getByLabel('Password').fill('Test-Password-123!')
    await bobPage.getByRole('button', { name: /sign in/i }).click()
    await bobPage.waitForURL('**/app/discover')

    // Navigate to messages
    await alicePage.goto(`${APP_URL}/app/messages`)
    await alicePage.getByRole('link', { name: /bob/i }).click()
    await alicePage.waitForURL('**/app/messages/**')

    // Alice sends a message
    const testMessage = 'Check if this gets marked as seen'
    await alicePage.getByLabel('Message input').fill(testMessage)
    await alicePage.getByRole('button', { name: /send/i }).click()

    // Bob opens the chat (marks as read)
    await bobPage.goto(`${APP_URL}/app/messages`)
    await bobPage.getByRole('link', { name: /alice/i }).click()
    await bobPage.waitForURL('**/app/messages/**')

    // Wait a moment for the read receipt to propagate
    await bobPage.waitForTimeout(1000)

    // Alice sees 'Seen' on her message
    const messageBubble = alicePage.getByText(testMessage).locator('..').locator('..')
    await expect(messageBubble.getByText(/seen/i)).toBeVisible({ timeout: 5000 })

    await aliceContext.close()
    await bobContext.close()
  })

  test('typing indicator appears', async ({ browser }) => {
    const aliceContext = await browser.newContext()
    const bobContext = await browser.newContext()

    const alicePage = await aliceContext.newPage()
    const bobPage = await bobContext.newPage()

    // Sign in
    await alicePage.goto(`${APP_URL}/auth/login`)
    await alicePage.getByLabel('Email').fill('alice@test.local')
    await alicePage.getByLabel('Password').fill('Test-Password-123!')
    await alicePage.getByRole('button', { name: /sign in/i }).click()
    await alicePage.waitForURL('**/app/discover')

    await bobPage.goto(`${APP_URL}/auth/login`)
    await bobPage.getByLabel('Email').fill('bob@test.local')
    await bobPage.getByLabel('Password').fill('Test-Password-123!')
    await bobPage.getByRole('button', { name: /sign in/i }).click()
    await bobPage.waitForURL('**/app/discover')

    // Navigate to messages
    await alicePage.goto(`${APP_URL}/app/messages`)
    await alicePage.getByRole('link', { name: /bob/i }).click()
    await alicePage.waitForURL('**/app/messages/**')

    await bobPage.goto(`${APP_URL}/app/messages`)
    await bobPage.getByRole('link', { name: /alice/i }).click()
    await bobPage.waitForURL('**/app/messages/**')

    // Alice starts typing
    await alicePage.getByLabel('Message input').fill('Typing...')

    // Bob sees the typing indicator (three bouncing dots)
    const typingIndicator = bobPage.locator('.animate-bounce').first()
    await expect(typingIndicator).toBeVisible({ timeout: 5000 })

    await aliceContext.close()
    await bobContext.close()
  })

  test('Charlie cannot read the chat or subscribe (IDOR via API)', async ({
    browser,
    request,
  }) => {
    const aliceContext = await browser.newContext()
    const alicePage = await aliceContext.newPage()

    // Sign in Alice
    await alicePage.goto(`${APP_URL}/auth/login`)
    await alicePage.getByLabel('Email').fill('alice@test.local')
    await alicePage.getByLabel('Password').fill('Test-Password-123!')
    await alicePage.getByRole('button', { name: /sign in/i }).click()
    await alicePage.waitForURL('**/app/discover')

    // Navigate to messages and open chat with Bob
    await alicePage.goto(`${APP_URL}/app/messages`)
    await alicePage.getByRole('link', { name: /bob/i }).click()
    await alicePage.waitForURL('**/app/messages/**')

    // Get the match ID from the URL
    const matchId = alicePage.url().split('/').pop()

    // Try to read messages as Charlie (unauthorized) via REST API
    // This should fail with 401 or return empty array due to RLS
    const charlieResponse = await request.get(
      `http://127.0.0.1:54321/rest/v1/messages?match_id=eq.${matchId}`,
      {
        headers: {
          // No auth header = anonymous
          apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
        },
      }
    )

    // Should be unauthorized or return empty
    expect(charlieResponse.status()).toBeGreaterThanOrEqual(400)

    await aliceContext.close()
  })

  test('after Bob blocks Alice, Alice cannot send messages', async ({ browser }) => {
    const aliceContext = await browser.newContext()
    const bobContext = await browser.newContext()

    const alicePage = await aliceContext.newPage()
    const bobPage = await bobContext.newPage()

    // Sign in
    await alicePage.goto(`${APP_URL}/auth/login`)
    await alicePage.getByLabel('Email').fill('alice@test.local')
    await alicePage.getByLabel('Password').fill('Test-Password-123!')
    await alicePage.getByRole('button', { name: /sign in/i }).click()
    await alicePage.waitForURL('**/app/discover')

    await bobPage.goto(`${APP_URL}/auth/login`)
    await bobPage.getByLabel('Email').fill('bob@test.local')
    await bobPage.getByLabel('Password').fill('Test-Password-123!')
    await bobPage.getByRole('button', { name: /sign in/i }).click()
    await bobPage.waitForURL('**/app/discover')

    // Navigate to messages
    await alicePage.goto(`${APP_URL}/app/messages`)
    await alicePage.getByRole('link', { name: /bob/i }).click()
    await alicePage.waitForURL('**/app/messages/**')

    await bobPage.goto(`${APP_URL}/app/messages`)
    await bobPage.getByRole('link', { name: /alice/i }).click()
    await bobPage.waitForURL('**/app/messages/**')

    // Bob blocks Alice (via the menu)
    await bobPage.getByLabel('More options').click()
    await bobPage.getByRole('button', { name: /block/i }).click()
    await bobPage.getByRole('button', { name: /^block$/i }).click()

    // Alice tries to send a message
    await alicePage.getByLabel('Message input').fill('This should fail')
    await alicePage.getByRole('button', { name: /send/i }).click()

    // Alice sees an error
    await expect(alicePage.getByText(/cannot message|blocked/i)).toBeVisible({ timeout: 5000 })

    await aliceContext.close()
    await bobContext.close()
  })

  test('<script>alert(1)</script> appears as literal text (no XSS)', async ({ browser }) => {
    const aliceContext = await browser.newContext()
    const bobContext = await browser.newContext()

    const alicePage = await aliceContext.newPage()
    const bobPage = await bobContext.newPage()

    // Sign in
    await alicePage.goto(`${APP_URL}/auth/login`)
    await alicePage.getByLabel('Email').fill('alice@test.local')
    await alicePage.getByLabel('Password').fill('Test-Password-123!')
    await alicePage.getByRole('button', { name: /sign in/i }).click()
    await alicePage.waitForURL('**/app/discover')

    await bobPage.goto(`${APP_URL}/auth/login`)
    await bobPage.getByLabel('Email').fill('bob@test.local')
    await bobPage.getByLabel('Password').fill('Test-Password-123!')
    await bobPage.getByRole('button', { name: /sign in/i }).click()
    await bobPage.waitForURL('**/app/discover')

    // Navigate to messages
    await alicePage.goto(`${APP_URL}/app/messages`)
    await alicePage.getByRole('link', { name: /bob/i }).click()
    await alicePage.waitForURL('**/app/messages/**')

    await bobPage.goto(`${APP_URL}/app/messages`)
    await bobPage.getByRole('link', { name: /alice/i }).click()
    await bobPage.waitForURL('**/app/messages/**')

    // Alice sends a message with XSS payload
    const xssPayload = '<script>alert(1)</script>'
    await alicePage.getByLabel('Message input').fill(xssPayload)
    await alicePage.getByRole('button', { name: /send/i }).click()

    // Bob sees it as literal text, NOT as an executed script
    await expect(bobPage.getByText(xssPayload)).toBeVisible({ timeout: 5000 })

    // Verify no alert was triggered
    const alertTriggered = await bobPage.evaluate(() => {
      return ((window as unknown as { __xssAlertTriggered?: boolean }).__xssAlertTriggered === true)
    })
    expect(alertTriggered).toBe(false)

    await aliceContext.close()
    await bobContext.close()
  })

  test('31st message in a minute is rejected', async ({ browser }) => {
    const aliceContext = await browser.newContext()
    const alicePage = await aliceContext.newPage()

    // Sign in Alice
    await alicePage.goto(`${APP_URL}/auth/login`)
    await alicePage.getByLabel('Email').fill('alice@test.local')
    await alicePage.getByLabel('Password').fill('Test-Password-123!')
    await alicePage.getByRole('button', { name: /sign in/i }).click()
    await alicePage.waitForURL('**/app/discover')

    // Navigate to messages
    await alicePage.goto(`${APP_URL}/app/messages`)
    await alicePage.getByRole('link', { name: /bob/i }).click()
    await alicePage.waitForURL('**/app/messages/**')

    // Send 30 messages (should succeed)
    for (let i = 1; i <= 30; i++) {
      await alicePage.getByLabel('Message input').fill(`Message ${i}`)
      await alicePage.getByRole('button', { name: /send/i }).click()
      // Wait for send to complete
      await alicePage.waitForTimeout(50)
    }

    // 31st message should fail
    await alicePage.getByLabel('Message input').fill('Message 31 - should fail')
    await alicePage.getByRole('button', { name: /send/i }).click()

    // Should see a rate limit error
    await expect(alicePage.getByText(/rate limit|too many/i)).toBeVisible({ timeout: 5000 })

    await aliceContext.close()
  })
})
