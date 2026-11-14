import { Suspense } from 'react'
import { NavLink, Link, Outlet } from 'react-router-dom'
import { Heart, MessageSquare, Compass, User, Settings, LogOut } from 'lucide-react'
import { useAuth } from '../../lib/authContext'
import { useUnreadStats } from '../../hooks/useUnreadStats'
import { usePendingContactRequestCount } from '../../hooks/useContactRequests'
import { cn } from '../../utils'
import { BottomNav, Button, PageSpinner } from '../ui'

const navItems = [
  { path: '/app/discover', label: 'Discover', icon: Compass },
  { path: '/app/search', label: 'Search', icon: Heart },
  { path: '/app/matches', label: 'Matches', icon: MessageSquare },
  { path: '/app/likes', label: 'Likes', icon: Heart },
  { path: '/app/me', label: 'Me', icon: User },
]

/**
 * Chrome for the signed-in application: brand header with the desktop app
 * navigation, the route outlet and a compact footer. Mobile gets a fixed
 * bottom tab bar instead of the header nav.
 */
export function MainLayout() {
  const { user, signOut } = useAuth()
  const unread = useUnreadStats()
  const likesBadge = unread.data?.newLikes ?? 0
  const messagesBadge = unread.data?.unreadMessages ?? 0

  // Unanswered WhatsApp-number requests light a dot on the settings gear.
  const pendingRequests = usePendingContactRequestCount()
  const pendingRequestsCount = pendingRequests.data ?? 0

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col pb-20 lg:pb-0">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[60] focus:top-3 focus:left-3 focus:rounded-lg focus:bg-primary-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to content
      </a>

      <header className="glass-strong border-b border-dark-800 sticky top-0 z-50">
        <div className="container">
          <div className="flex items-center justify-between h-16 gap-4">
            <NavLink
              to="/app/discover"
              className="flex items-center gap-2 shrink-0"
              aria-label="HeartConnect Home"
            >
              <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
                <Heart className="w-5 h-5 text-white" aria-hidden="true" />
              </span>
              <span className="font-display text-xl font-bold text-dark-50 hidden sm:block">
                HeartConnect
              </span>
            </NavLink>

            <nav className="hidden lg:flex items-center gap-1" aria-label="Main navigation">
              {navItems.map(({ path, label, icon: Icon }) => {
                const count =
                  path === '/app/matches' ? messagesBadge : path === '/app/likes' ? likesBadge : 0
                const shown = count > 99 ? '99+' : String(count)
                return (
                <NavLink
                  key={path}
                  to={path}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                      isActive
                        ? 'bg-primary-600/20 text-primary-400'
                        : 'text-dark-400 hover:text-dark-100 hover:bg-dark-800'
                    )
                  }
                >
                  <Icon className="w-4 h-4" aria-hidden="true" />
                  {label}
                  {count > 0 && (
                    <span
                      className="min-w-[18px] rounded-full bg-primary-600 px-1.5 py-0.5 text-center text-[10px] font-bold leading-none text-white"
                      aria-label={path === '/app/matches' ? `${count} unread messages` : `${count} new likes`}
                    >
                      {shown}
                    </span>
                  )}
                </NavLink>
                )
              })}
            </nav>

            <div className="flex items-center gap-2">
              <NavLink
                to="/app/settings"
                className={({ isActive }) =>
                  cn(
                    'relative p-2 rounded-xl transition-colors',
                    isActive
                      ? 'bg-primary-600/20 text-primary-400'
                      : 'text-dark-400 hover:text-dark-100 hover:bg-dark-800'
                  )
                }
                aria-label={
                  pendingRequestsCount > 0
                    ? `Settings, ${pendingRequestsCount} unanswered WhatsApp request${pendingRequestsCount === 1 ? '' : 's'}`
                    : 'Settings'
                }
              >
                <Settings className="w-5 h-5" aria-hidden="true" />
                {pendingRequestsCount > 0 && (
                  <span
                    className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary-500 shadow-glow"
                    aria-hidden="true"
                  />
                )}
              </NavLink>
              {user && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="hidden lg:inline-flex"
                  onClick={() => void signOut()}
                >
                  <LogOut className="w-4 h-4 mr-1.5" aria-hidden="true" />
                  Sign Out
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main id="main-content" className="flex-1">
        <Suspense fallback={<PageSpinner className="py-24" />}>
          <Outlet />
        </Suspense>
      </main>

      <footer className="glass-strong border-t border-dark-800 hidden lg:block">
        <div className="container py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-dark-500 text-sm">
              &copy; {new Date().getFullYear()} HeartConnect &middot; 18+ only
            </p>
            <div className="flex items-center gap-5">
              {[
                { to: '/privacy', label: 'Privacy' },
                { to: '/terms', label: 'Terms' },
                { to: '/safety', label: 'Safety' },
                { to: '/contact', label: 'Contact' },
              ].map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  className="text-dark-500 hover:text-dark-300 text-sm transition-colors"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </footer>

      <BottomNav likesBadge={likesBadge} messagesBadge={messagesBadge} />
    </div>
  )
}
