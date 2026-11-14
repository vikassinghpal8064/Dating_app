import { NavLink } from 'react-router-dom'
import { Heart, MessageSquare, Compass, User, Star } from 'lucide-react'
import { cn } from '../../utils'

const bottomNavItems = [
  { path: '/app/discover', label: 'Discover', icon: Compass },
  { path: '/app/search', label: 'Search', icon: Heart },
  { path: '/app/matches', label: 'Matches', icon: MessageSquare },
  { path: '/app/likes', label: 'Likes', icon: Star },
  { path: '/app/me', label: 'Me', icon: User },
]

interface BottomNavProps {
  /** Incoming likes the member has not reciprocated. */
  likesBadge?: number
  /** Received messages that have not been read yet. */
  messagesBadge?: number
}

const badgeFor: Record<string, keyof NonNullable<BottomNavProps>> = {
  '/app/likes': 'likesBadge',
  '/app/matches': 'messagesBadge',
}

/** Fixed mobile tab bar; the desktop equivalent lives in `MainLayout`'s header. */
export function BottomNav({ likesBadge = 0, messagesBadge = 0 }: BottomNavProps) {
  const counts = { likesBadge, messagesBadge }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 lg:hidden glass-strong border-t border-dark-800 z-50 pb-[env(safe-area-inset-bottom)]"
      aria-label="Bottom navigation"
    >
      <div className="grid grid-cols-5">
        {bottomNavItems.map(({ path, label, icon: Icon }) => {
          const key = badgeFor[path]
          const count = key ? counts[key] : 0
          const hasBadge = count > 0
          const shown = count > 99 ? '99+' : String(count)
          return (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center gap-1 py-2.5 transition-colors duration-200',
                  isActive ? 'text-primary-400' : 'text-dark-500 hover:text-dark-300'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span className="relative">
                    <Icon
                      className={cn('w-6 h-6 transition-transform', isActive && 'scale-110')}
                      aria-hidden="true"
                    />
                    {hasBadge && (
                      <span
                        aria-hidden="true"
                        className="absolute -top-1.5 -right-2 min-w-[16px] rounded-full bg-primary-600 px-1 text-center text-[10px] font-bold leading-4 text-white ring-2 ring-dark-950"
                      >
                        {shown}
                      </span>
                    )}
                  </span>
                  <span className="text-[11px] font-medium">{label}</span>
                  {hasBadge && (
                    <span className="sr-only">
                      , {count} {key === 'messagesBadge' ? 'unread messages' : 'new likes'}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}