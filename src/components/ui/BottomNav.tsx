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

/** Fixed mobile tab bar; the desktop equivalent lives in `MainLayout`'s header. */
export function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 lg:hidden glass-strong border-t border-dark-800 z-50 pb-[env(safe-area-inset-bottom)]"
      aria-label="Bottom navigation"
    >
      <div className="grid grid-cols-5">
        {bottomNavItems.map(({ path, label, icon: Icon }) => (
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
                <Icon
                  className={cn('w-6 h-6 transition-transform', isActive && 'scale-110')}
                  aria-hidden="true"
                />
                <span className="text-[11px] font-medium">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
