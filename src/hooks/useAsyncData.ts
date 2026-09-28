import { useCallback, useEffect, useRef, useState } from 'react'

export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error'

export interface AsyncState<T> {
  data: T | null
  status: AsyncStatus
  error: string | null
  reload: () => void
}

/**
 * Runs an async Supabase query and tracks its lifecycle.
 *
 * `load` must be a stable callback (wrap it in `useCallback`) — the effect
 * re-runs whenever it changes. Results from a superseded call are discarded, so
 * a slow first request can never overwrite fresher data.
 */
export function useAsyncData<T>(load: () => Promise<{ data: T | null; error: string | null }>) {
  const [data, setData] = useState<T | null>(null)
  const [status, setStatus] = useState<AsyncStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const requestId = useRef(0)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    const current = ++requestId.current
    const isCurrent = () => mounted.current && requestId.current === current

    setStatus('loading')
    setError(null)

    load()
      .then((result) => {
        if (!isCurrent()) return
        setData(result.data)
        setError(result.error)
        setStatus(result.error ? 'error' : 'success')
      })
      .catch((err: unknown) => {
        if (!isCurrent()) return
        setError(err instanceof Error ? err.message : 'Something went wrong')
        setStatus('error')
      })
  }, [load, reloadToken])

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  return { data, status, error, reload }
}
