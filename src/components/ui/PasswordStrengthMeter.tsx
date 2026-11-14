import { passwordStrength } from '../../utils/validation'
import type { PasswordStrength } from '../../utils/validation'
import { cn } from '../../utils'

const METER: Record<
  Exclude<PasswordStrength, 'empty'>,
  { label: string; fill: string; text: string; width: string }
> = {
  weak: { label: 'Weak', fill: 'bg-red-500', text: 'text-red-400', width: '25%' },
  fair: { label: 'Fair', fill: 'bg-accent-gold', text: 'text-accent-gold', width: '50%' },
  good: { label: 'Good', fill: 'bg-primary-500', text: 'text-primary-400', width: '75%' },
  strong: { label: 'Strong', fill: 'bg-accent-emerald', text: 'text-accent-emerald', width: '100%' },
}

/**
 * Live password strength bar for the sign-up form.
 *
 * Renders nothing while the field is empty so the metre appears only when
 * there is something to judge. `role="meter"` exposes the reading to assistive
 * tech even though the bar is purely decorative.
 */
export function PasswordStrengthMeter({ password }: { password: string }) {
  const strength = passwordStrength(password)
  if (strength === 'empty') return null

  const { label, fill, text, width } = METER[strength]

  return (
    <div className="mt-2">
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(parseFloat(width))}
        aria-label={`Password strength: ${label}`}
        className="h-1.5 w-full rounded-full bg-dark-800 overflow-hidden"
      >
        <div
          className={cn('h-full rounded-full transition-all duration-300', fill)}
          style={{ width }}
        />
      </div>
      <p className={cn('mt-1 text-xs font-medium', text)} aria-hidden="true">
        {label}
      </p>
    </div>
  )
}