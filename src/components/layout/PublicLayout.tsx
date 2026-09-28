import { Suspense } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Heart } from 'lucide-react'
import { Button, Footer, PageSpinner } from '../ui'
import { cn } from '../../utils'

const publicNavItems = [
  { path: '/about', label: 'About' },
  { path: '/safety', label: 'Safety' },
  { path: '/contact', label: 'Contact' },
]

/**
 * Chrome for the marketing / legal surface: brand header, route outlet and the
 * site footer. Authenticated app screens use `MainLayout` instead, so the two
 * never stack two headers or two footers on one page.
 */
export function PublicLayout() {
  return (
    <div className="min-h-screen bg-dark-950 flex flex-col">
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
              to="/"
              className="flex items-center gap-2 shrink-0"
              aria-label="HeartConnect Home"
            >
              <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
                <Heart className="w-5 h-5 text-white" aria-hidden="true" />
              </span>
              <span className="font-display text-xl font-bold text-dark-50">HeartConnect</span>
            </NavLink>

            <nav
              className="hidden md:flex items-center gap-1"
              aria-label="Site navigation"
            >
              {publicNavItems.map(({ path, label }) => (
                <NavLink
                  key={path}
                  to={path}
                  className={({ isActive }) =>
                    cn(
                      'px-4 py-2 rounded-xl text-sm font-medium transition-colors duration-200',
                      isActive
                        ? 'bg-primary-600/20 text-primary-400'
                        : 'text-dark-400 hover:text-dark-100 hover:bg-dark-800'
                    )
                  }
                >
                  {label}
                </NavLink>
              ))}
            </nav>

            <div className="flex items-center gap-2 sm:gap-3">
              <NavLink
                to="/auth/login"
                className="px-3 py-2 text-sm font-medium text-dark-300 hover:text-dark-50 transition-colors whitespace-nowrap"
              >
                Sign In
              </NavLink>
              <NavLink to="/auth/signup" className="hidden sm:block">
                <Button size="sm">Get Started</Button>
              </NavLink>
            </div>
          </div>
        </div>
      </header>

      <main id="main-content" className="flex-1">
        <Suspense fallback={<PageSpinner className="py-24" />}>
          <Outlet />
        </Suspense>
      </main>

      <Footer />
    </div>
  )
}
