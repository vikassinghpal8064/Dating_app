import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'
import { cn } from '../../utils'

export interface ToggleProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
  description?: string
}

/**
 * The knob is drawn with an `after:` pseudo-element rather than a nested child,
 * because Tailwind's `peer-checked:` variant only matches *siblings* of the
 * peer input. A nested child could never react to the checkbox state.
 */
export const Toggle = forwardRef<HTMLInputElement, ToggleProps>(
  ({ className, label, description, id, ...props }, ref) => {
    const toggleId = id ?? `toggle-${label?.toLowerCase().replace(/\s+/g, '-') ?? 'unnamed'}`

    return (
      <label className={cn('flex items-start gap-3 cursor-pointer', className)}>
        <input
          ref={ref}
          id={toggleId}
          type="checkbox"
          className="peer sr-only"
          {...props}
        />
        <span
          aria-hidden="true"
          className={cn(
            'relative mt-0.5 block h-6 w-11 shrink-0 rounded-full transition-colors duration-200',
            'bg-dark-700 peer-checked:bg-primary-600 peer-hover:peer-checked:bg-primary-500',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-primary-500 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-dark-950',
            'after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full',
            'after:bg-white after:shadow-md after:transition-transform after:duration-200',
            'peer-checked:after:translate-x-5',
            'peer-disabled:cursor-not-allowed peer-disabled:opacity-50'
          )}
        />
        {(label || description) && (
          <span className="text-sm">
            {label && <span className="block text-dark-100">{label}</span>}
            {description && <span className="mt-0.5 block text-dark-500">{description}</span>}
          </span>
        )}
      </label>
    )
  }
)

Toggle.displayName = 'Toggle'
