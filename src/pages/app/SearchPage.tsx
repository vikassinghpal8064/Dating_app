import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search as SearchIcon, SlidersHorizontal, X } from 'lucide-react'
import {
  Button,
  Input,
  PageContainer,
  PageHeader,
  ProfileCard,
  QueryState,
  SearchEmptyState,
} from '../../components/ui'
import { useDiscoverProfiles } from '../../hooks/useDiscover'
import type { PublicProfile } from '../../types'

const GENDER_FILTERS: { value: string; label: string }[] = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'male', label: 'Men' },
  { value: 'female', label: 'Women' },
  { value: 'non_binary', label: 'Non-binary' },
]

export function SearchPage() {
  const navigate = useNavigate()
  const { data, status, error, reload } = useDiscoverProfiles(50)

  const [query, setQuery] = useState('')
  const [gender, setGender] = useState('everyone')
  const [city, setCity] = useState('')

  const results = useMemo(() => {
    const all = data ?? []
    const needle = query.trim().toLowerCase()
    const cityNeedle = city.trim().toLowerCase()

    return all.filter((profile: PublicProfile) => {
      if (gender !== 'everyone' && !profile.interested_in.includes(gender)) {
        // Fall back to the person's own gender so the filter matches how people
        // describe themselves as well as who they are looking for.
        if (profile.gender !== gender) return false
      }
      if (cityNeedle && !profile.location_city.toLowerCase().includes(cityNeedle)) {
        return false
      }
      if (!needle) return true
      return (
        profile.full_name.toLowerCase().includes(needle) ||
        profile.location_city.toLowerCase().includes(needle) ||
        (profile.bio ?? '').toLowerCase().includes(needle)
      )
    })
  }, [data, query, gender, city])

  const hasFilters = query.trim() !== '' || gender !== 'everyone' || city.trim() !== ''

  const clearFilters = useCallback(() => {
    setQuery('')
    setGender('everyone')
    setCity('')
  }, [])

  return (
    <PageContainer>
      <PageHeader
        title="Search"
        subtitle="Filter the people already visible to you. Nothing here reveals more than a match could see."
      />

      <form
        className="mb-8 grid gap-4 rounded-2xl border border-dark-700 bg-dark-900/60 p-5 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={(e) => e.preventDefault()}
        role="search"
      >
        <div className="lg:col-span-2">
          <Input
            label="Search by name or bio"
            type="search"
            placeholder="Try a name, city or interest"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <Input
          label="City"
          placeholder="Any city"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />

        <fieldset>
          <legend className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-dark-300">
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            Show
          </legend>
          <div className="flex flex-wrap gap-2">
            {GENDER_FILTERS.map((filter) => {
              const isActive = gender === filter.value
              return (
                <button
                  key={filter.value}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setGender(filter.value)}
                  className={[
                    'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                    isActive
                      ? 'border-primary-500 bg-primary-600/30 text-primary-200'
                      : 'border-dark-600 text-dark-300 hover:border-dark-500',
                  ].join(' ')}
                >
                  {filter.label}
                </button>
              )
            })}
          </div>
        </fieldset>

        {hasFilters && (
          <div className="sm:col-span-2 lg:col-span-4">
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4" aria-hidden="true" />
              Clear filters
            </Button>
          </div>
        )}
      </form>

      <p className="mb-4 text-sm text-dark-400" aria-live="polite">
        {status === 'success'
          ? `${results.length} ${results.length === 1 ? 'person' : 'people'} found`
          : 'Searching…'}
      </p>

      <QueryState
        status={status}
        error={error}
        onRetry={reload}
        label="results"
        isEmpty={results.length === 0}
        empty={<SearchEmptyState onAction={clearFilters} />}
      >
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((profile) => (
            <li key={profile.id}>
              <ProfileCard
                profile={profile}
                showActions={false}
                onViewProfile={() => navigate(`/app/profile/${profile.id}`)}
              />
            </li>
          ))}
        </ul>
      </QueryState>

      {status === 'success' && !hasFilters && results.length > 0 && (
        <p className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-dark-500">
          <SearchIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
          Only people who are already visible to you appear here.
        </p>
      )}
    </PageContainer>
  )
}
