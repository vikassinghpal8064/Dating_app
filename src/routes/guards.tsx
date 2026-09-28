import { Navigate, Outlet, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../lib/authContext'
import { PageSpinner } from '../components/ui'

function GuardFallback() {
  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center">
      <PageSpinner size="lg" variant="primary" />
    </div>
  )
}

interface GuardProps {
  children?: ReactNode
}

/** Renders `children` when given, otherwise the nested `<Outlet />`. */
function GuardShell({ children }: GuardProps) {
  return <>{children ?? <Outlet />}</>
}

/**
 * Requires an authenticated user. Sends anonymous visitors to the login page
 * and remembers where they were heading.
 */
export function ProtectedRoute({ children }: GuardProps = {}) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <GuardFallback />

  if (!user) {
    return <Navigate to="/auth/login" state={{ from: location.pathname }} replace />
  }

  return <GuardShell>{children}</GuardShell>
}

/**
 * Requires an authenticated user with the `admin` role. The role comes from the
 * server-issued profile record; it is never inferred client-side from an email
 * address.
 */
export function AdminRoute({ children }: GuardProps = {}) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <GuardFallback />

  if (!user) {
    return <Navigate to="/auth/login" state={{ from: location.pathname }} replace />
  }

  if (!user.is_admin) {
    return <Navigate to="/app/discover" replace />
  }

  return <GuardShell>{children}</GuardShell>
}

/** Signed-in users are bounced away from login/signup/reset screens. */
export function GuestRoute({ children }: GuardProps = {}) {
  const { user, loading } = useAuth()

  if (loading) return <GuardFallback />

  if (user) {
    return <Navigate to="/app/discover" replace />
  }

  return <GuardShell>{children}</GuardShell>
}
