import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'
import { cn } from '../../utils'

export interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  description?: string
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, description, id, ...props }, ref) => {
    const checkboxId = id || label.toLowerCase().replace(/\s+/g, '-')
    
    return (
      <label className={cn('flex items-start gap-3 cursor-pointer', className)}>
        <input
          ref={ref}
          id={checkboxId}
          type="checkbox"
          className={cn(
            'w-4 h-4 mt-0.5 rounded border-dark-600 bg-dark-800',
            'text-primary-600 focus:ring-primary-500 focus:ring-2',
            'transition-colors duration-200'
          )}
          {...props}
        />
        <div className="text-sm">
          <span className="text-dark-100">{label}</span>
          {description && (
            <p className="text-dark-500 mt-0.5">{description}</p>
          )}
        </div>
      </label>
    )
  }
)

Checkbox.displayName = 'Checkbox'