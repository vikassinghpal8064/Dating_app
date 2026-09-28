import React from 'react'
import { cn } from '../../utils'

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular' | 'avatar' | 'card'
  width?: string | number
  height?: string | number
  lines?: number
}

export function Skeleton({ 
  className, 
  variant = 'text', 
  width, 
  height, 
  lines = 1,
  ...props 
}: SkeletonProps) {
  const baseStyle = 'bg-dark-800 rounded animate-pulse'

  const variants = {
    text: 'h-4 w-full',
    circular: 'rounded-full',
    rectangular: 'rounded-xl',
    avatar: 'rounded-full',
    card: 'rounded-2xl',
  }

  if (variant === 'text' && lines > 1) {
    return (
      <div className={cn('space-y-2', className)} {...props}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(baseStyle, variants.text, i === lines - 1 && 'w-3/4')}
            style={{ width: i === lines - 1 ? '75%' : '100%' }}
          />
        ))}
      </div>
    )
  }

  return (
    <div
      className={cn(baseStyle, variants[variant], className)}
      style={{ width, height }}
      {...props}
    />
  )
}

export function ProfileCardSkeleton() {
  return (
    <div className="glass rounded-2xl overflow-hidden">
      <Skeleton variant="rectangular" className="aspect-[4/5] w-full" />
      <div className="p-5 space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton variant="avatar" className="w-10 h-10" />
          <div className="flex-1 space-y-2">
            <Skeleton variant="text" width="60%" />
            <Skeleton variant="text" width="40%" />
          </div>
        </div>
        <Skeleton variant="text" lines={2} />
        <div className="flex flex-wrap gap-2">
          <Skeleton variant="circular" className="w-20 h-8" />
          <Skeleton variant="circular" className="w-24 h-8" />
          <Skeleton variant="circular" className="w-28 h-8" />
        </div>
      </div>
    </div>
  )
}

export function MessageSkeleton({ own = false }: { own?: boolean }) {
  return (
    <div className={cn('flex gap-3', own && 'justify-end')}>
      {!own && <Skeleton variant="avatar" className="w-8 h-8 shrink-0" />}
      <div className={cn('max-w-[70%]', own && 'order-1')}>
        <Skeleton variant="text" width={own ? '80%' : '60%'} />
        <Skeleton variant="text" width={own ? '50%' : '40%'} className="mt-1" />
      </div>
    </div>
  )
}