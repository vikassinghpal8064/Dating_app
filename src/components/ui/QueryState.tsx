import { AlertCircle, RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from './Button'
import { PageSpinner } from './Spinner'
import { EmptyState } from './EmptyState'
import { cn } from '../../utils'
import type { AsyncStatus } from '../../hooks/useAsyncData'

interface QueryStateProps {
  status: AsyncStatus
  error: string | null
  onRetry: () => void
  /** Required unless `isEmpty` is true and an `empty` node is supplied. */
  children?: ReactNode
  /** Rendered instead of `children` when the query succeeded with nothing. */
  empty?: ReactNode
  isEmpty?: boolean
  label?: string
}

/**
 * One place that decides what a user sees for a data-backed screen, so loading,
 * failure and empty results look the same everywhere — and so a failed request
 * is never mistaken for "no results".
 */
export function QueryState({
  status,
  error,
  onRetry,
  children,
  empty,
  isEmpty = false,
  label = 'content',
}: QueryStateProps) {
  if (status === 'loading' || status === 'idle') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20" role="status">
        <PageSpinner size="lg" variant="primary" />
        <p className="text-dark-400 text-sm">Loading {label}…</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div
        className="flex flex-col items-center justify-center gap-4 py-16 px-4 text-center"
        role="alert"
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10">
          <AlertCircle className="h-7 w-7 text-red-400" aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-display text-lg font-semibold text-dark-50">
            We could not load {label}
          </h2>
          <p className="mt-2 max-w-md text-sm text-dark-400">
            {error ?? 'The request did not complete. Nothing was changed.'}
          </p>
        </div>
        <Button variant="outline" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Try again
        </Button>
      </div>
    )
  }

  if (isEmpty) {
    return (
      <>
        {empty ?? (
          <EmptyState
            title={`No ${label} yet`}
            description="Nothing to show here right now. Check back a little later."
          />
        )}
      </>
    )
  }

  return <>{children}</>
}

interface MessageProps {
  children: ReactNode
  tone?: 'info' | 'error' | 'success'
  className?: string
}

const tones = {
  info: 'bg-primary-600/10 border-primary-600/20 text-primary-300',
  error: 'bg-red-500/10 border-red-500/20 text-red-300',
  success: 'bg-accent-emerald/10 border-accent-emerald/20 text-accent-emerald',
}

/** Inline status banner used for form submissions and background results. */
export function InlineMessage({ children, tone = 'info', className }: MessageProps) {
  return (
    <div
      className={cn('flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm', tones[tone], className)}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  )
}
