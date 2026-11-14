import { useEffect, useId, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { RotateCcw, SlidersHorizontal } from 'lucide-react'
import { Button, Select, Toggle } from '../ui'
import { INTEREST_OPTIONS, LOOKING_FOR_LABELS } from '../../utils/search'
import type { LookingFor, SearchFilters, SearchGender } from '../../types'

interface FiltersPanelProps {
  open: boolean
  filters: SearchFilters
  onChange: (patch: Partial<SearchFilters>) => void
  onReset: () => void
  onClose: () => void
}

const GENDERS: { value: SearchGender; label: string }[] = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'male', label: 'Men' },
  { value: 'female', label: 'Women' },
  { value: 'non_binary', label: 'Non-binary' },
]

const LOOKING_FOR_OPTIONS = (Object.keys(LOOKING_FOR_LABELS) as LookingFor[]).map((value) => ({
  value,
  label: LOOKING_FOR_LABELS[value],
}))

function ageOptions(from: number, to: number): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = []
  for (let age = from; age <= to; age += 1) {
    options.push({ value: String(age), label: String(age) })
  }
  return options
}

function heightOptions(from: number, to: number): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [{ value: '', label: 'Any' }]
  for (let cm = from; cm <= to; cm += 1) {
    options.push({ value: String(cm), label: `${cm} cm` })
  }
  return options
}

/**
 * Slide-over that edits every /search filter except city and radius. The page
 * owns the URL; every change here funnels through `onChange` and lands in the
 * query string, so filters survive a reload and back/forward.
 */
export function FiltersPanel({ open, filters, onChange, onReset, onClose }: FiltersPanelProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    panelRef.current?.focus()
  }, [open])

  const setAge = (patch: { minAge?: number; maxAge?: number }) => {
    const next = { ...filters, ...patch }
    if (next.minAge > next.maxAge) {
      next.maxAge = next.minAge
    }
    onChange({ minAge: next.minAge, maxAge: next.maxAge })
  }

  const toggleLookingFor = (value: LookingFor) => {
    const has = filters.lookingFor.includes(value)
    onChange({
      lookingFor: has
        ? filters.lookingFor.filter((item) => item !== value)
        : [...filters.lookingFor, value],
    })
  }

  const toggleInterest = (value: string) => {
    const has = filters.interests.includes(value)
    onChange({
      interests: has
        ? filters.interests.filter((item) => item !== value)
        : [...filters.interests, value],
    })
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.aside
            key="panel"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-dark-700 bg-dark-950 shadow-glow-xl"
          >
            <header className="flex items-center gap-3 border-b border-dark-800 px-6 py-5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-600/20 text-primary-400">
                <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 id={titleId} className="font-display text-xl font-semibold text-dark-50">
                Filters
              </h2>
            </header>

            <div className="flex-1 space-y-7 overflow-y-auto px-6 py-6">
              <fieldset>
                <legend className="mb-3 text-sm font-medium text-dark-300">Age range</legend>
                <div className="grid grid-cols-2 gap-3">
                  <Select
                    label="Minimum age"
                    options={ageOptions(18, 80)}
                    value={String(filters.minAge)}
                    onChange={(event) => setAge({ minAge: Number(event.target.value) })}
                  />
                  <Select
                    label="Maximum age"
                    options={ageOptions(18, 99)}
                    value={String(filters.maxAge)}
                    onChange={(event) => setAge({ maxAge: Number(event.target.value) })}
                  />
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-3 text-sm font-medium text-dark-300">
                  Show profiles of
                </legend>
                <div className="flex flex-wrap gap-2">
                  {GENDERS.map((option) => {
                    const active = filters.gender === option.value
                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={active}
                        onClick={() => onChange({ gender: option.value })}
                        className={[
                          'rounded-full border px-3.5 py-2 text-sm font-medium transition-colors',
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
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-3 text-sm font-medium text-dark-300">Looking for</legend>
                <div className="flex flex-wrap gap-2">
                  {LOOKING_FOR_OPTIONS.map((option) => {
                    const active = filters.lookingFor.includes(option.value)
                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleLookingFor(option.value)}
                        className={[
                          'rounded-full border px-3.5 py-2 text-sm font-medium transition-colors',
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
                </div>
              </fieldset>

              <div className="space-y-4">
                <Toggle
                  label="Verified only"
                  description="Only members whose identity is verified."
                  checked={filters.verifiedOnly}
                  onChange={(event) => onChange({ verifiedOnly: event.target.checked })}
                />
                <Toggle
                  label="Online recently"
                  description="Active within the last five minutes."
                  checked={filters.onlineOnly}
                  onChange={(event) => onChange({ onlineOnly: event.target.checked })}
                />
                <Toggle
                  label="Has photos"
                  description="Everyone shown here has at least one approved photo — this stays on."
                  checked
                  disabled
                />
              </div>

              <fieldset>
                <legend className="mb-3 text-sm font-medium text-dark-300">Interests</legend>
                <div className="flex flex-wrap gap-2">
                  {INTEREST_OPTIONS.map((interest) => {
                    const active = filters.interests.includes(interest)
                    return (
                      <button
                        key={interest}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleInterest(interest)}
                        className={[
                          'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                          active
                            ? 'border-primary-500 bg-primary-600/30 text-primary-200'
                            : 'border-dark-600 text-dark-300 hover:border-dark-500',
                        ].join(' ')}
                      >
                        {interest}
                      </button>
                    )
                  })}
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-3 text-sm font-medium text-dark-300">Height (cm)</legend>
                <div className="grid grid-cols-2 gap-3">
                  <Select
                    label="Minimum height"
                    options={heightOptions(140, 220)}
                    value={filters.minHeightCm === null ? '' : String(filters.minHeightCm)}
                    onChange={(event) => {
                      const value = event.target.value
                      onChange({ minHeightCm: value === '' ? null : Number(value) })
                    }}
                  />
                  <Select
                    label="Maximum height"
                    options={heightOptions(140, 220)}
                    value={filters.maxHeightCm === null ? '' : String(filters.maxHeightCm)}
                    onChange={(event) => {
                      const value = event.target.value
                      onChange({ maxHeightCm: value === '' ? null : Number(value) })
                    }}
                  />
                </div>
              </fieldset>
            </div>

            <footer className="flex items-center justify-between gap-3 border-t border-dark-800 px-6 py-4">
              <Button variant="ghost" size="sm" onClick={onReset} aria-label="Reset all filters">
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Reset
              </Button>
              <Button variant="primary" onClick={onClose}>
                Done
              </Button>
            </footer>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}