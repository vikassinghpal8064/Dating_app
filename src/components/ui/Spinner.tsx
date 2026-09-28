import React from 'react'
import { cn } from '../../utils'

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'default' | 'primary' | 'white'
}

const sizes = {
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-8 h-8 border-3',
  xl: 'w-12 h-12 border-3',
}

const variants = {
  default: 'border-dark-600 border-t-primary-500',
  primary: 'border-primary-200 border-t-primary-500',
  white: 'border-white/30 border-t-white',
}

export function Spinner({ className, size = 'md', variant = 'default', ...props }: SpinnerProps) {
  return (
    <div
      className={cn(
        'inline-block rounded-full animate-spin',
        sizes[size],
        variants[variant],
        className
      )}
      role="status"
      aria-label="Loading"
      {...props}
    >
      <span className="sr-only">Loading...</span>
    </div>
  )
}

export function PageSpinner({ size = 'lg', variant = 'primary', className }: SpinnerProps) {
  return (
    <div className={cn('flex items-center justify-center min-h-[300px]', className)}>
      <Spinner size={size} variant={variant} />
    </div>
  )
}

export function ButtonSpinner({ size = 'md', variant = 'white', className }: SpinnerProps) {
  return <Spinner size={size} variant={variant} className={className} />
}

export function InlineSpinner({ size = 'sm', variant = 'default', className }: SpinnerProps) {
  return <Spinner size={size} variant={variant} className={cn('inline-block align-middle', className)} />
}