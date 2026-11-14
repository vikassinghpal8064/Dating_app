import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { debounce } from '../utils'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/authContext'
import {
  buildSearchRpcArgs,
  toCityOption,
  toSearchProfile,
  withApprovedPhotos,
  type SearchCenter,
} from '../utils/search'
import type { AsyncStatus } from './useAsyncData'
import type { CityOption, SearchFilters, SearchProfile } from '../types'

/**
 * The /search results for one filter set, paged 20 at a time.
 *
 * Any change to the filters (a new URL, a change made in the slide-over)
 * replaces the results; `loadMore` appends the next page and the page wires
 * it to an IntersectionObserver sentinel.
 */
export function useSearchProfiles(filters: SearchFilters, center: SearchCenter | null) {
  const { user } = useAuth()
  const [profiles, setProfiles] = useState<SearchProfile[]>([])
  const [status, setStatus] = useState<AsyncStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const requestId = useRef(0)

  const firstPageArgs = useMemo(
    () => buildSearchRpcArgs(filters, center, 20, 0),
    [filters, center]
  )
  const firstPageKey = useMemo(() => JSON.stringify(firstPageArgs), [firstPageArgs])

  const loadFirstPage = useCallback(async () => {
    const current = ++requestId.current
    setStatus('loading')
    setError(null)
    if (!user) {
      setProfiles([])
      setHasMore(false)
      setStatus('success')
      return
    }
    const { data, error: rpcError } = await supabase.rpc('search_profiles', firstPageArgs)
    if (requestId.current !== current) return
    if (rpcError) {
      setError(rpcError.message)
      setStatus('error')
      return
    }
    const rows = (data ?? []).map(toSearchProfile)
    const merged = await withApprovedPhotos(rows)
    if (requestId.current !== current) return
    setProfiles(merged)
    setHasMore(rows.length === 20)
    setStatus('success')
  }, [user, firstPageArgs])

  // (Re)load whenever the first-page arguments change, and on retry.
  const appliedKey = useRef<string | null>(null)
  useEffect(() => {
    if (appliedKey.current === firstPageKey) return
    appliedKey.current = firstPageKey
    void loadFirstPage()
  }, [firstPageKey, loadFirstPage])

  const reload = useCallback(() => {
    appliedKey.current = null
    void loadFirstPage()
  }, [loadFirstPage])

  const loadMore = useCallback(async () => {
    if (loadingMore || status !== 'success' || !hasMore) return
    setLoadingMore(true)
    const offset = profiles.length
    const { data, error: rpcError } = await supabase.rpc('search_profiles', {
      ...firstPageArgs,
      offset_count: offset,
    })
    if (rpcError) {
      setLoadingMore(false)
      return
    }
    const rows = (data ?? []).map(toSearchProfile)
    const merged = await withApprovedPhotos(rows)
    setProfiles((prev) => [...prev, ...merged])
    setHasMore(rows.length === 20)
    setLoadingMore(false)
  }, [firstPageArgs, hasMore, loadingMore, profiles.length, status])

  return { profiles, status, error, reload, loadMore, hasMore, loadingMore }
}

/**
 * Debounced city gazetteer autocomplete. Call `search` with the input's value;
 * results reset whenever the query drops below two characters.
 */
export function useCityAutocomplete() {
  const [options, setOptions] = useState<CityOption[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)

  const debouncedSearch = useMemo(
    () =>
      debounce(async (needle: string) => {
        const current = ++requestId.current
        const clean = needle.trim()
        if (clean.length < 2) {
          setOptions([])
          setStatus('idle')
          return
        }
        setStatus('loading')
        setError(null)
        const { data, error: queryError } = await supabase
          .from('city_coordinates')
          .select('city, country, latitude, longitude')
          .ilike('city', `${clean}%`)
          .order('city', { ascending: true })
          .limit(8)
        if (requestId.current !== current) return
        if (queryError) {
          setError(queryError.message)
          setStatus('error')
          return
        }
        setOptions((data ?? []).map(toCityOption))
        setStatus('success')
      }, 250),
    []
  )

  const reset = useCallback(() => {
    requestId.current += 1
    setOptions([])
    setStatus('idle')
    setError(null)
  }, [])

  useEffect(() => {
    const request = requestId
    return () => {
      request.current += 1
    }
  }, [])

  return { search: debouncedSearch, options, status, error, reset }
}