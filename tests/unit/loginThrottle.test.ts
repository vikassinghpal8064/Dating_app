import { describe, it, expect, beforeEach } from 'vitest'
import {
  LOCK_SECONDS,
  MAX_FAILED_ATTEMPTS,
  readThrottle,
  registerFailedLogin,
  registerSuccessfulLogin,
} from '@/utils/loginThrottle'

const STORAGE_KEY = 'login-throttle'

/** A minimal sessionStorage shim, since vitest's node env has no window. */
function installStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial))
  const storage: Storage = {
    getItem: (key) => (store.has(key) ? (store.get(key) as string) : null),
    setItem: (key, value) => {
      store.set(key, value)
    },
    removeItem: (key) => {
      store.delete(key)
    },
    clear: () => store.clear(),
    key: (index) => [...store.keys()][index] ?? null,
    get length() {
      return store.size
    },
  }
  Object.defineProperty(globalThis, 'window', {
    value: { sessionStorage: storage },
    configurable: true,
  })
  return { store, storage }
}

const T0 = 1_000_000

describe('loginThrottle', () => {
  beforeEach(() => {
    installStorage()
  })

  it('starts unlocked with no failures recorded', () => {
    expect(readThrottle(T0)).toEqual({ locked: false, remainingMs: 0, failures: 0 })
  })

  it('counts failures without locking before the threshold', () => {
    for (let i = 1; i < MAX_FAILED_ATTEMPTS; i++) {
      const reading = registerFailedLogin(T0 + i * 1_000)
      expect(reading.locked).toBe(false)
      expect(reading.failures).toBe(i)
    }
  })

  it('locks for LOCK_SECONDS once the threshold is reached', () => {
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
      registerFailedLogin(T0 + (i + 1) * 1_000)
    }

    const locked = readThrottle(T0 + MAX_FAILED_ATTEMPTS * 1_000)
    expect(locked.locked).toBe(true)
    expect(locked.remainingMs).toBe(LOCK_SECONDS * 1000)
    expect(locked.failures).toBe(MAX_FAILED_ATTEMPTS)
  })

  it('holds the lock for its full duration read after read', () => {
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
      registerFailedLogin(T0 + (i + 1) * 1_000)
    }

    const halfway = readThrottle(T0 + 5_000 + LOCK_SECONDS * 500)
    expect(halfway.locked).toBe(true)
    expect(halfway.remainingMs).toBe(LOCK_SECONDS * 500)
  })

  it('does not extend the lock while it is already active', () => {
    let now = T0
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
      registerFailedLogin((now += 1_000))
    }

    // A brute-forcer keeps trying during the lock; the clock must not move.
    for (let i = 0; i < 10; i++) {
      now += 1_000
      registerFailedLogin(now)
    }

    const still = readThrottle(now)
    expect(still.locked).toBe(true)
    expect(now).toBe(T0 + 15_000)
    // The lock was set at the fifth failure (T0 + 5s), so it still has
    // 35s − 15s = 20s to run — not the 15s a naive extension would leave.
    expect(still.remainingMs).toBe(T0 + 5_000 + LOCK_SECONDS * 1000 - now)
  })

  it('returns to a clean slate after the lock expires', () => {
    let now = T0
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
      registerFailedLogin((now += 1_000))
    }

    const after = readThrottle(now + LOCK_SECONDS * 1000 + 1)
    expect(after).toEqual({ locked: false, remainingMs: 0, failures: 0 })
  })

  it('resets on a successful sign-in', () => {
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
      registerFailedLogin(T0 + i * 1_000)
    }
    registerSuccessfulLogin()
    expect(readThrottle(T0 + MAX_FAILED_ATTEMPTS * 1_000)).toEqual({
      locked: false,
      remainingMs: 0,
      failures: 0,
    })
  })

  it('persists across reads through sessionStorage', () => {
    const { storage } = installStorage()
    expect(storage.getItem(STORAGE_KEY)).toBeNull()

    registerFailedLogin(T0)
    const raw = storage.getItem(STORAGE_KEY)
    expect(raw).toBeTruthy()
    // The stored state round-trips: a fresh read sees the same failures.
    expect(readThrottle(T0 + 1)).toEqual({ locked: false, remainingMs: 0, failures: 1 })
  })

  it('degrades to unlocked when storage is unavailable', () => {
    // A browser where sessionStorage throws (private mode, blocked policies)
    // must not lock the user out; Supabase's own rate limit still applies.
    Object.defineProperty(globalThis, 'window', {
      value: {
        sessionStorage: {
          getItem() {
            throw new Error('blocked')
          },
          setItem() {
            throw new Error('blocked')
          },
        },
      },
      configurable: true,
    })

    expect(readThrottle(T0)).toEqual({ locked: false, remainingMs: 0, failures: 0 })
    // The count can only live in memory now, so the lock can never trip — which
    // is the point. Each call reports itself as a first attempt.
    expect(registerFailedLogin(T0)).toEqual({ locked: false, remainingMs: 0, failures: 1 })
    expect(registerFailedLogin(T0 + 1_000)).toEqual({ locked: false, remainingMs: 0, failures: 1 })
  })
})