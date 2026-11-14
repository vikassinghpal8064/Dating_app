/**
 * Client-side sign-in throttling.
 *
 * Supabase already rate-limits the token endpoint; this is the UX layer on
 * top: after `MAX_FAILED_ATTEMPTS` failed sign-ins the form locks for
 * `LOCK_SECONDS`, so a user who is being brute-forced (or who simply forgot
 * their password and is hammering it) sees a hard stop with a countdown
 * instead of a treadmill of generic errors.
 *
 * The lock is recorded in `sessionStorage` rather than memory so a refresh in
 * the same tab does not silently reset the clock, and rather than
 * `localStorage` because this is a per-tab affordance, never a credential.
 * Nothing personally identifying is written.
 *
 * All reads/writes are wrapped in try/catch so a blocked storage (private
 * mode, strict policies) degrades to "never locked", which is the safe
 * direction: Supabase's own rate limit still applies.
 */

export const MAX_FAILED_ATTEMPTS = 5
export const LOCK_SECONDS = 30
const STORAGE_KEY = 'login-throttle'

export interface ThrottleState {
  failures: number
  lockedUntil: number
}

export interface ThrottleReading {
  /** Whether the form must be locked right now. */
  locked: boolean
  /** Milliseconds until the lock lifts; 0 when not locked. */
  remainingMs: number
  /** Failures so far in the current window (0 while locked). */
  failures: number
}

interface StoredThrottle {
  failures: number
  lockedUntil: number | null
}

function readStored(now: number): StoredThrottle {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return { failures: 0, lockedUntil: null }

    const parsed = JSON.parse(raw) as Partial<StoredThrottle>
    const failures = typeof parsed.failures === 'number' && parsed.failures > 0 ? parsed.failures : 0
    const lockedUntil =
      typeof parsed.lockedUntil === 'number' && Number.isFinite(parsed.lockedUntil)
        ? parsed.lockedUntil
        : null

    // An expired lock is a clean slate: the count it carried has been paid for.
    if (lockedUntil !== null && lockedUntil <= now) return { failures: 0, lockedUntil: null }

    return { failures, lockedUntil }
  } catch {
    return { failures: 0, lockedUntil: null }
  }
}

function writeStored(state: StoredThrottle) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // No storage, no lock — see the module comment for why that is the safe side.
  }
}

/** Reads the current throttle state. `now` is injectable for tests. */
export function readThrottle(now = Date.now()): ThrottleReading {
  const { failures, lockedUntil } = readStored(now)

  if (lockedUntil !== null && lockedUntil > now) {
    return { locked: true, remainingMs: lockedUntil - now, failures: MAX_FAILED_ATTEMPTS }
  }

  return { locked: false, remainingMs: 0, failures }
}

/**
 * Records one failed sign-in and returns the state to render.
 *
 * An active lock is returned unchanged: continued attempts during the pause
 * must not push the clock forward. A caller behind the lockout UI will never
 * reach here anyway; this guards the reload race where a stale page submits
 * the instant the timer expires.
 */
export function registerFailedLogin(now = Date.now()): ThrottleReading {
  const state = readStored(now)

  if (state.lockedUntil !== null && state.lockedUntil > now) {
    return { locked: true, remainingMs: state.lockedUntil - now, failures: MAX_FAILED_ATTEMPTS }
  }

  const failures = state.failures + 1

  if (failures >= MAX_FAILED_ATTEMPTS) {
    const lockedUntil = now + LOCK_SECONDS * 1000
    writeStored({ failures, lockedUntil })
    return { locked: true, remainingMs: LOCK_SECONDS * 1000, failures }
  }

  writeStored({ failures, lockedUntil: null })
  return { locked: false, remainingMs: 0, failures }
}

/** Clears the throttle after a successful sign-in. */
export function registerSuccessfulLogin() {
  writeStored({ failures: 0, lockedUntil: null })
}