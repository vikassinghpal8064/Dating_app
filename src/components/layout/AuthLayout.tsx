import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { Heart, ShieldCheck, Lock } from 'lucide-react'
import { Card, PageSpinner } from '../ui'

const trustPoints = [
  { icon: ShieldCheck, label: 'Age verified, adults only' },
  { icon: Lock, label: 'Phone numbers stay private' },
]

/** Chrome for the login / signup / password-reset screens. */
export function AuthLayout() {
  return (
    <div className="min-h-screen bg-dark-950 flex flex-col">
      <div
        className="hidden lg:block lg:fixed lg:inset-0 lg:z-0 overflow-hidden pointer-events-none"
        aria-hidden="true"
      >
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-primary-600/10 rounded-full blur-3xl animate-pulse-soft" />
        <div
          className="absolute bottom-1/4 left-1/4 w-72 h-72 bg-accent-gold/10 rounded-full blur-3xl animate-pulse-soft"
          style={{ animationDelay: '1s' }}
        />
      </div>

      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link
              to="/"
              className="inline-flex flex-col items-center gap-4"
              aria-label="HeartConnect Home"
            >
              <span className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-glow-lg">
                <Heart className="w-8 h-8 text-white" aria-hidden="true" />
              </span>
              <span className="font-display text-3xl sm:text-4xl font-bold text-dark-50">
                HeartConnect
              </span>
            </Link>
            <p className="text-dark-400 text-base sm:text-lg mt-2">
              Premium dating for meaningful connections
            </p>
          </div>

          <Card variant="glass-strong" padding="lg">
            <Suspense fallback={<PageSpinner className="py-12" />}>
              <Outlet />
            </Suspense>
          </Card>

          <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mt-6">
            {trustPoints.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-1.5 text-dark-500 text-xs">
                <Icon className="w-3.5 h-3.5 text-primary-500" aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>

          <p className="text-center text-dark-500 text-sm mt-4">
            By continuing, you agree to our{' '}
            <Link to="/terms" className="text-primary-400 hover:text-primary-300 underline">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link to="/privacy" className="text-primary-400 hover:text-primary-300 underline">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  )
}
