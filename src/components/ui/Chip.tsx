import { forwardRef } from 'react'
import type { HTMLAttributes } from 'react'
import { cn } from '../../utils'
import { X } from 'lucide-react'

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'outline' | 'filled'
  size?: 'sm' | 'md'
  removable?: boolean
  onRemove?: () => void
  selected?: boolean
}

const sizes = {
  sm: 'px-2.5 py-0.5 text-xs gap-1',
  md: 'px-3 py-1 text-sm gap-1.5',
}

export const Chip = forwardRef<HTMLSpanElement, ChipProps>(
  (
    {
      className,
      variant = 'default',
      size = 'md',
      removable,
      onRemove,
      selected,
      children,
      ...props
    },
    ref
  ) => {
    const variants = {
      default:
        'bg-dark-800 border border-dark-700 text-dark-300 hover:border-dark-600 hover:text-dark-100',
      outline:
        'bg-transparent border border-dark-600 text-dark-300 hover:border-primary-500 hover:text-primary-400',
      filled: 'bg-primary-600/20 border border-primary-500/30 text-primary-400',
    }

    const selectedStyles = selected
      ? 'bg-primary-600/30 border-primary-500 text-primary-300'
      : ''

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-full font-medium transition-all duration-200',
          sizes[size],
          variants[variant],
          selectedStyles,
          removable && 'pr-2',
          className
        )}
        {...props}
      >
        {children}
        {removable && (
          <button
            type="button"
            onClick={onRemove}
            className={cn(
              'p-0.5 rounded-full transition-colors',
              'hover:bg-white/10',
              variant === 'filled' && 'hover:bg-primary-500/20'
            )}
            aria-label="Remove"
          >
            <X className="w-3 h-3" aria-hidden="true" />
          </button>
        )}
      </span>
    )
  }
)

Chip.displayName = 'Chip'