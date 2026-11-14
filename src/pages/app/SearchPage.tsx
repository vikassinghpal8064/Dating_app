import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { RotateCcw, Search as SearchIcon, SlidersHorizontal } from 'lucide-react'
import { useAuth } from '../../lib/authContext'
import { useSearchProfiles } from '../../hooks/useSearch'
import { CityAutocomplete } from '../../components/search/CityAutocomplete'
import { FiltersPanel } from '../../components/search/FiltersPanel'
import { SearchResultCard } from '../../components/search/SearchResultCard'
import {
  Button,
  EmptyState,
  InlineMessage,
  PageContainer,
  PageHeader,
  ProfileCardSkeleton,
} from '../../components/ui'
import {
  activeFilterCount,
  ANYWHERE_RADIUS_LABEL,
  buildSearchParams,
  parseSearchParams,
  RADIUS_OPTIONS,
  type SearchCenter,
} from '../../utils/search'
import type { CityOption, DistanceRadiusKm, SearchFilters } from '../../types'

/**
 * /search — people finder with a shareable, back-button-friendly URL for every
 * filter. The query string is the source of truth: filters parse from it, and
 * every change writes back to it, so results reload on back/forward and a copy
 * of the link shows the same grid to someone else.
 */
export function SearchPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = useMemo(() => parseSearchParams(searchParams.toString()), [searchParams])
  const { user } = useAuth()

  const callerCenter: SearchCenter | null =
    user?.latitude != null && user?.longitude != null
      ? { lat: user.latitude, lng: user.longitude }
      : null

  const [cityText, setCityText] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)

  // Keep the field in step with the applied filter (a shared link, back/forward).
  useEffect(() => {
    setCityText((prev) => (filters.city ? (prev === '' ? filters.city : prev) : ''))
  }, [filters.city])

  const applyFilters = useCallback(
    (patch: Partial<SearchFilters>) => {
      setSearchParams(new URLSearchParams(buildSearchParams({ ...filters, ...patch })))
    },
    [filters, setSearchParams]
  )

  const handleSelectCity = (city: CityOption) => {
    setCityText(city.city)
    applyFilters({ city: city.city })
  }

  const handleClearCity = () => {
    setCityText('')
    applyFilters({ city: null })
  }

  const setRadius = (radiusKm: DistanceRadiusKm | null) => applyFilters({ radiusKm })

  const resetAll = useCallback(() => {
    setCityText('')
    setSearchParams(new URLSearchParams())
  }, [setSearchParams])

  const { profiles, status, error, reload, loadMore, hasMore, loadingMore } =
    useSearchProfiles(filters, callerCenter)

  const sentinelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore()
      },
      { rootMargin: '400px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [loadMore])

  const activeCount = activeFilterCount(filters)
  const loading = status === 'idle' || (status === 'loading' && profiles.length === 0)
  const showError = status === 'error' && profiles.length === 0

  return (
    <PageContainer>
      <PageHeader
        title="Search"
        subtitle="Find people by city and distance. Every filter is baked into the link."
      />

      {/* Controls */}
      <section
        className="rounded-2xl border border-dark-800 bg-dark-900/60 p-4"
        aria-label="Search controls"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <CityAutocomplete
            value={cityText}
            selectedCityName={filters.city}
            onSelect={handleSelectCity}
            onInputChange={setCityText}
            onClear={handleClearCity}
          />

          <div>
            <p id="radius-label" className="mb-1.5 block text-sm font-medium text-dark-300">
              Distance
            </p>
            <div
              role="group"
              aria-labelledby="radius-label"
              className="flex flex-wrap items-center gap-1.5"
            >
              {RADIUS_OPTIONS.map((option) => {
                const active = filters.radiusKm === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setRadius(active ? null : option.value)}
                    className={[
                      'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                      active
                        ? 'border-primary-500 bg-primary-600/30 text-primary-200'
                        : 'border-dark-600 text-dark-300 hover:border-dark-500',
                    ].join(' ')}
                  >
                    {option.label}
                  </button>
                )
              })}
              <button
                type="button"
                aria-pressed={filters.radiusKm === null}
                onClick={() => setRadius(null)}
                className={[
                  'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                  filters.radiusKm === null
                    ? 'border-primary-500 bg-primary-600/30 text-primary-200'
                    : 'border-dark-600 text-dark-300 hover:border-dark-500',
                ].join(' ')}
              >
                {ANYWHERE_RADIUS_LABEL}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3 border-t border-dark-800 pt-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setFiltersOpen(true)}
            aria-label={`More filters${activeCount > 0 ? ` (${activeCount} active)` : ''}`}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            Filters
            {activeCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-600 px-1.5 text-xs font-semibold text-white">
                {activeCount}
              </span>
            )}
          </Button>
          {activeCount > 0 && (
            <Button variant="ghost" size="sm" onClick={resetAll} aria-label="Clear all filters">
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Reset
            </Button>
          )}
        </div>
      </section>

      {/* Results */}
      <p className="mt-6 text-sm text-dark-400" aria-live="polite">
        {status === 'success' && profiles.length > 0
          ? `${profiles.length} member${profiles.length === 1 ? '' : 's'} found`
          : loading
            ? 'Finding people nearby…'
            : '\u00a0'}
      </p>

      {showError ? (
        <div className="mt-4 space-y-4">
          <InlineMessage tone="error">
            The search could not be completed{error ? `: ${error}` : '.'}
          </InlineMessage>
          <Button variant="outline" size="sm" onClick={reload}>
            Try again
          </Button>
        </div>
      ) : loading ? (
        <ul className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => (
            <li key={index}>
              <ProfileCardSkeleton />
            </li>
          ))}
        </ul>
      ) : profiles.length === 0 ? (
        <EmptyState
          icon={<SearchIcon className="h-10 w-10 text-primary-500" aria-hidden="true" />}
          title="No one matches those filters"
          description="Widen the distance, clear a filter or two, and try again — new members join every day."
          action={
            activeCount > 0
              ? { label: 'Reset filters', onClick: resetAll }
              : { label: 'Explore Discover', onClick: () => navigate('/app/discover') }
          }
          className="mt-8"
        />
      ) : (
        <>
          <ul className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {profiles.map((profile) => (
              <li key={profile.id}>
                <SearchResultCard profile={profile} />
              </li>
            ))}
          </ul>
          <div ref={sentinelRef} className="flex justify-center py-6" aria-hidden="true">
            {loadingMore && (
              <span className="text-sm text-dark-500" role="status">
                Loading more…
              </span>
            )}
            {!hasMore && profiles.length > 0 && (
              <span className="text-sm text-dark-500">You&rsquo;re all caught up.</span>
            )}
          </div>
        </>
      )}

      <FiltersPanel
        open={filtersOpen}
        filters={filters}
        onChange={applyFilters}
        onReset={resetAll}
        onClose={() => setFiltersOpen(false)}
      />
    </PageContainer>
  )
}