import { forwardRef } from 'react'
import type { ImgHTMLAttributes } from 'react'
import { cn } from '../../utils'

export interface AvatarProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'className'> {
  src?: string | null
  className?: string
  alt?: string
  fallback?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  status?: 'online' | 'offline' | 'away'
  statusPosition?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
}

const sizes = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-12 h-12 text-lg',
  xl: 'w-16 h-16 text-xl',
  '2xl': 'w-24 h-24 text-2xl',
}

const statusSizes = {
  xs: 'w-1.5 h-1.5',
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
  lg: 'w-3 h-3',
  xl: 'w-3.5 h-3.5',
  '2xl': 'w-4 h-4',
}

const statusPositions = {
  'bottom-right': 'bottom-0 right-0',
  'bottom-left': 'bottom-0 left-0',
  'top-right': 'top-0 right-0',
  'top-left': 'top-0 left-0',
}

const statusLabels: Record<NonNullable<AvatarProps['status']>, string> = {
  online: 'Online now',
  away: 'Away',
  offline: 'Offline',
}

/**
 * Renders a profile image, or the person's initials when no photo is set.
 * The forwarded ref always points at the outer wrapper so callers can measure
 * or scroll to the avatar regardless of which branch rendered.
 */
export const Avatar = forwardRef<HTMLSpanElement, AvatarProps>(
  (
    {
      className,
      src,
      alt = '',
      fallback,
      size = 'md',
      status,
      statusPosition = 'bottom-right',
      // Image-only attributes must not leak onto the wrapper or the fallback.
      width,
      height,
      loading,
      decoding,
      onLoad,
      onError,
      crossOrigin,
      referrerPolicy,
      ...props
    },
    ref
  ) => {
    const initials = fallback
      ? fallback
          .split(' ')
          .filter(Boolean)
          .map((part) => part[0])
          .join('')
          .toUpperCase()
          .slice(0, 2)
      : '?'

    const hasImage = typeof src === 'string' && src.length > 0
    const label = alt || fallback || 'Profile photo'

    return (
      <span ref={ref} className={cn('relative inline-flex shrink-0', className)}>
        {hasImage ? (
          <img
            src={src}
            alt={label}
            width={width}
            height={height}
            loading={loading}
            decoding={decoding}
            onLoad={onLoad}
            onError={onError}
            crossOrigin={crossOrigin}
            referrerPolicy={referrerPolicy}
            className={cn(sizes[size], 'rounded-full object-cover ring-2 ring-dark-800')}
            {...props}
          />
        ) : (
          <span
            role="img"
            aria-label={label}
            className={cn(
              sizes[size],
              'rounded-full bg-gradient-to-br from-primary-600 to-primary-800',
              'flex items-center justify-center font-medium uppercase text-white ring-2 ring-dark-800'
            )}
          >
            {initials}
          </span>
        )}
        {status && (
          <span
            aria-hidden="true"
            className={cn(
              'absolute rounded-full border-2 border-dark-950',
              statusSizes[size],
              statusPositions[statusPosition],
              status === 'online' && 'bg-accent-emerald',
              status === 'away' && 'bg-accent-gold',
              status === 'offline' && 'bg-dark-500'
            )}
          />
        )}
        {status && <span className="sr-only">{statusLabels[status]}</span>}
      </span>
    )
  }
)

Avatar.displayName = 'Avatar'
