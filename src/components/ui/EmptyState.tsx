import type { ReactNode } from 'react'
import { cn } from '../../utils'
import { Button } from './Button'
import { Search, Heart, MessageSquare, User, Sparkles } from 'lucide-react'

export interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: { label: string; onClick: () => void; variant?: 'primary' | 'secondary' | 'outline' }
  secondaryAction?: { label: string; onClick: () => void }
  className?: string
}

export function EmptyState({ 
  icon, 
  title, 
  description, 
  action, 
  secondaryAction, 
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center py-16 px-4', className)}>
      <div className="w-20 h-20 rounded-2xl bg-primary-600/10 flex items-center justify-center mb-6">
        {icon ?? <Sparkles className="w-10 h-10 text-primary-500" aria-hidden="true" />}
      </div>
      <h3 className="font-display text-xl font-semibold text-dark-50 mb-2">{title}</h3>
      {description && (
        <p className="text-dark-400 text-base max-w-sm mb-6 leading-relaxed">{description}</p>
      )}
      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-sm">
          {action && (
            <Button 
              variant={action.variant || 'primary'} 
              className="w-full sm:w-auto" 
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="ghost" className="w-full sm:w-auto" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

/** Shared shape for the pre-composed empty states below. */
export interface EmptyStateActions {
  onAction?: () => void
  onSecondary?: () => void
}

export function DiscoverEmptyState({ onAction, onSecondary }: EmptyStateActions = {}) {
  return (
    <EmptyState
      icon={<Heart className="w-10 h-10 text-primary-500" aria-hidden="true" />}
      title="No one new around you"
      description="You have seen everyone matching your preferences. Try expanding your distance or filters, or check back later."
      action={onAction ? { label: 'Expand search', onClick: onAction, variant: 'outline' } : undefined}
      secondaryAction={onSecondary ? { label: 'Update preferences', onClick: onSecondary } : undefined}
    />
  )
}

export function MatchesEmptyState({ onAction }: EmptyStateActions = {}) {
  return (
    <EmptyState
      icon={<MessageSquare className="w-10 h-10 text-primary-500" aria-hidden="true" />}
      title="No matches yet"
      description="A match is created when you and someone else both connect. Nothing has been created for your account yet."
      action={onAction ? { label: 'Browse Discover', onClick: onAction } : undefined}
    />
  )
}

export function SearchEmptyState({ onAction }: EmptyStateActions = {}) {
  return (
    <EmptyState
      icon={<Search className="w-10 h-10 text-primary-500" aria-hidden="true" />}
      title="No results found"
      description="Try adjusting your filters or search criteria to find more people."
      action={onAction ? { label: 'Clear filters', onClick: onAction, variant: 'outline' } : undefined}
    />
  )
}

export function ProfileEmptyState({ onAction }: EmptyStateActions = {}) {
  return (
    <EmptyState
      icon={<User className="w-10 h-10 text-primary-500" aria-hidden="true" />}
      title="Profile not found"
      description="This profile may have been removed, or the link may be wrong."
      action={onAction ? { label: 'Back to Discover', onClick: onAction, variant: 'outline' } : undefined}
    />
  )
}