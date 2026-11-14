import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { MapPin, Search as SearchIcon, X } from 'lucide-react'
import { useCityAutocomplete } from '../../hooks/useSearch'
import { cn } from '../../utils'
import type { CityOption } from '../../types'

interface CityAutocompleteProps {
  /** Text currently shown in the field (the selected city or free text). */
  value: string
  /** Applied city filter, shown as the placeholder when the field is empty. */
  selectedCityName: string | null
  onSelect: (city: CityOption) => void
  onInputChange: (text: string) => void
  onClear: () => void
}

/**
 * Combobox feeding the search centre. Selecting an option commits the whole
 * city name to the filters (the server resolves exact coordinates); clearing
 * returns the search centre to the caller's own location. Keyboard: ↑/↓ move,
 * Enter picks, Escape dismisses.
 */
export function CityAutocomplete({
  value,
  selectedCityName,
  onSelect,
  onInputChange,
  onClear,
}: CityAutocompleteProps) {
  const { search, options, status, reset } = useCityAutocomplete()
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setHighlighted(0)
  }, [options])

  useEffect(() => {
    if (status === 'idle' || status === 'error') setOpen(false)
    else setOpen(true)
  }, [status])

  const pick = (city: CityOption) => {
    reset()
    onSelect(city)
    setOpen(false)
  }

  const handleInput = (text: string) => {
    onInputChange(text)
    search(text)
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (!open || options.length === 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        search(value)
      }
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlighted((index) => Math.min(index + 1, options.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlighted((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      pick(options[highlighted])
    } else if (event.key === 'Escape') {
      reset()
      containerRef.current?.querySelector('input')?.blur()
    }
  }

  useEffect(() => {
    const onGlobalKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') reset()
    }
    document.addEventListener('keydown', onGlobalKeyDown)
    return () => document.removeEventListener('keydown', onGlobalKeyDown)
  }, [reset])

  const listboxId = 'city-options'
  const showingOptions = open && options.length > 0

  return (
    <div ref={containerRef} className="relative">
      <label htmlFor="search-city" className="mb-1.5 block text-sm font-medium text-dark-300">
        City
      </label>
      <div className="relative">
        <SearchIcon
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-500"
          aria-hidden="true"
        />
        <input
          id="search-city"
          role="combobox"
          aria-expanded={showingOptions}
          aria-controls={showingOptions ? listboxId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={showingOptions ? `${listboxId}-${highlighted}` : undefined}
          aria-label="Search city"
          className="w-full rounded-xl border border-dark-700 bg-dark-900 py-3 pl-10 pr-9 text-dark-50 placeholder-dark-500 transition-colors hover:border-dark-600 focus-visible:border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          placeholder={selectedCityName ?? 'Anywhere'}
          value={value}
          onChange={(event) => handleInput(event.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (options.length > 0) setOpen(true)
          }}
        />
        {selectedCityName ? (
          <button
            type="button"
            onClick={onClear}
            aria-label={`Clear city ${selectedCityName}`}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-dark-400 transition-colors hover:bg-dark-800 hover:text-dark-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : (
          <MapPin
            className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-500"
            aria-hidden="true"
          />
        )}
      </div>

      {showingOptions && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="City suggestions"
          className="absolute z-20 mt-1.5 w-full overflow-hidden rounded-xl border border-dark-700 bg-dark-900 shadow-glow-lg"
        >
          {options.map((city, index) => (
            <li
              key={`${city.city}-${city.country}`}
              id={`${listboxId}-${index}`}
              role="option"
              aria-selected={index === highlighted}
              onMouseDown={(event) => {
                event.preventDefault()
                pick(city)
              }}
              onMouseEnter={() => setHighlighted(index)}
              className={cn(
                'flex cursor-pointer items-center gap-2 px-4 py-2.5 text-sm text-dark-200 transition-colors',
                index === highlighted && 'bg-primary-600/20 text-primary-200'
              )}
            >
              <MapPin className="h-4 w-4 shrink-0 text-primary-400" aria-hidden="true" />
              <span className="truncate">
                {city.city}
                {city.country ? `, ${city.country}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}