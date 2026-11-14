import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { Heart, ShieldCheck, Lock, Sparkles } from 'lucide-react'
import { Card, PageSpinner } from '../ui'

const trustPoints = [
  { icon: ShieldCheck, label: 'Age verified, adults only' },
  { icon: Lock, label: 'Phone numbers stay private' },
]

/**
 * Chrome for the login / signup / password-reset screens.
 *
 * Split-screen on desktop: a romantic photo-style gradient panel leads the
 * left half, the form lives on the right. The panel hides below `lg`, where
 * the full-height form column takes over the whole viewport. The decorative
 * panel is purely visual (`aria-hidden`) — every control below is on the
 * right-hand column.
 */
export function AuthLayout() {
  return (
    <div className="min-h-screen bg-dark-950 lg:grid lg:grid-cols-2">
      {/* Left: romantic gradient panel, desktop only */}
      <div
        className="relative hidden lg:flex flex-col justify-between overflow-hidden p-12 xl:p-16 bg-gradient-to-br from-primary-800 via-primary-950 to-dark-950"
        aria-hidden="true"
      >
        <div className="absolute inset-0 pointer-events-none">
          {/* Soft "photo" glows — layered like light through a lens */}
          <div className="absolute -top-24 -left-24 w-[28rem] h-[28rem] bg-primary-500/20 rounded-full blur-3xl" />
          <div className="absolute top-1/3 right-0 w-96 h-96 bg-accent-gold/15 rounded-full blur-3xl animate-pulse-soft" />
          <div className="absolute bottom-0 left-1/4 w-[24rem] h-[24rem] bg-primary-700/25 rounded-full blur-3xl animate-pulse-soft" style={{ animationDelay: '1.2s' }} />
          {/* Scattered heart silhouettes, like confetti in the gradient */}
          <Heart className="absolute top-24 right-20 w-16 h-16 text-white/10 rotate-12" />
          <Heart className="absolute bottom-32 left-16 w-10 h-10 text-white/10 -rotate-6" />
          <Heart className="absolute top-1/2 left-1/3 w-6 h-6 text-white/10 rotate-45" />
        </div>

        <div className="relative flex items-center gap-3">
          <span className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
            <Heart className="w-6 h-6 text-white" />
          </span>
          <span className="font-display text-2xl font-bold text-white">HeartConnect</span>
        </div>

        <div className="relative space-y-8">
          <h2 className="font-display text-4xl xl:text-5xl font-bold text-white leading-tight max-w-md">
            Where meaningful connections start.
          </h2>
          <p className="text-primary-100/85 text-lg max-w-sm text-balance">
            A premium dating experience built on consent, privacy and genuine
            conversation — adults only, verified on the way in.
          </p>
          <ul className="space-y-3">
            {trustPoints.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2.5 text-white/85 text-sm">
                <Icon className="w-4 h-4 text-accent-gold" />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center gap-2 text-white/60 text-xs">
          <Sparkles className="w-3.5 h-3.5" />
          Adults only · 18+
        </div>
      </div>

      {/* Right: the form column */}
      <main className="flex items-center justify-center min-h-screen lg:min-h-0 px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          {/* Mobile brand (the desktop brand lives in the left panel) */}
          <div className="lg:hidden text-center mb-8">
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