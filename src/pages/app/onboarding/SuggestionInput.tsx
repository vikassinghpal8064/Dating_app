import { useId, useMemo, useState } from 'react'
import { cn } from '../../../utils'

interface SuggestionInputProps {
  label: string
  id?: string
  value: string
  suggestions: readonly string[]
  onChange: (value: string) => void
  error?: string
  helperText?: string
  placeholder?: string
  required?: boolean
  maxLength?: number
}

/**
 * A searchable text input with suggestions. Users are *not* locked to the
 * list — a member who already set a value at sign-up (say "Leeds") keeps it
 * even when it is only present in the typed form — but the suggestions make
 * picking quick and predictable. Keyboard: ArrowUp/Down move the highlight,
 * Enter accepts it, Escape closes the list, and the list itself is exposed to
 * assistive tech as ARIA-friendly as a plain text box can be.
 */
export function SuggestionInput({
  label,
  id,
  value,
  suggestions,
  onChange,
  error,
  helperText,
  placeholder,
  required,
  maxLength,
}: SuggestionInputProps) {
  const autoId = useId()
  const listId = id ?? autoId
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  const filtered = useMemo(() => {
    const needle = value.trim().toLowerCase()
    if (!needle) return suggestions.slice(0, 8)
    return suggestions.filter((suggestion) => suggestion.toLowerCase().includes(needle)).slice(0, 8)
  }, [suggestions, value])

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={listId} className="block text-sm font-medium text-dark-300 mb-1.5">
          {label}
          {required && <span className="text-primary-500" aria-hidden="true"> *</span>}
        </label>
      )}
      <input
        id={listId}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? `${listId}-list` : undefined}
        aria-activedescendant={open ? `${listId}-option-${active}` : undefined}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${listId}-error` : helperText ? `${listId}-helper` : undefined}
        onChange={(event) => {
          onChange(event.target.value)
          setOpen(true)
          setActive(0)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && open) {
            event.preventDefault()
            setActive((index) => Math.min(index + 1, filtered.length - 1))
          } else if (event.key === 'ArrowUp' && open) {
            event.preventDefault()
            setActive((index) => Math.max(index - 1, 0))
          } else if (event.key === 'Enter' && open && filtered[active]) {
            event.preventDefault()
            onChange(filtered[active])
            setOpen(false)
          } else if (event.key === 'Escape') {
            setOpen(false)
          }
        }}
        className={cn(
          'w-full bg-dark-900 border rounded-xl px-4 py-3 text-dark-50 placeholder-dark-500 transition-all duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent',
          error && 'border-red-500 focus-visible:ring-red-500',
          !error && 'border-dark-700 hover:border-dark-600'
        )}
      />
      {open && filtered.length > 0 && (
        <ul
          id={`${listId}-list`}
          role="listbox"
          aria-label={`Suggestions for ${label}`}
          className="mt-1 max-h-56 overflow-auto rounded-xl border border-dark-700 bg-dark-900 py-1 shadow-xl"
        >
          {filtered.map((suggestion, index) => (
            <li
              key={suggestion}
              id={`${listId}-option-${index}`}
              role="option"
              aria-selected={index === active}
              onMouseDown={(event) => {
                // Run before onBlur so the click registers as a choice.
                event.preventDefault()
                onChange(suggestion)
                setOpen(false)
              }}
              className={cn(
                'cursor-pointer px-4 py-2 text-sm text-dark-200',
                index === active && 'bg-primary-600/15 text-primary-300'
              )}
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p id={`${listId}-error`} className="mt-1.5 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
      {helperText && !error && (
        <p id={`${listId}-helper`} className="mt-1.5 text-sm text-dark-500">
          {helperText}
        </p>
      )}
    </div>
  )
}