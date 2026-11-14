interface ProgressBarProps {
  /** 0-based current step. */
  current: number
  /** Total number of steps. */
  total: number
}

/**
 * The wizard's "Step n of 8" strip. It communicates progress to assistive
 * technology via the standard progressbar roles instead of a bare div.
 */
export function ProgressBar({ current, total }: ProgressBarProps) {
  const stepNumber = Math.min(current + 1, total)
  const percent = Math.round((stepNumber / total) * 100)

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-primary-400">Step {stepNumber} of {total}</span>
        <span className="text-dark-500">{current === total - 1 ? 'Almost there' : `${total - stepNumber} to go`}</span>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-dark-800"
        role="progressbar"
        aria-valuenow={stepNumber}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`Step ${stepNumber} of ${total}`}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-600 transition-[width] duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}