import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertCircle, CheckCircle2, Eye, EyeOff, Lock } from 'lucide-react'
import { Button, Label, PageSpinner } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import { PASSWORD_REQUIREMENTS } from '../../utils/validation'
import { cn } from '../../utils'

type LinkStatus = 'checking' | 'ok' | 'invalid'

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [linkStatus, setLinkStatus] = useState<LinkStatus>('checking')

  /*
   * Whether this page is a live recovery link.
   *
   * The implicit flow ships the recovery token as `#access_token=...`. The
   * PKCE flow ships a `code` in the query string that supabase-js exchanges
   * *before* this component mounts and then strips from the URL — leaving a
   * session but no trace. So "did the link work" is decided by the session,
   * not by the URL shape. A bare visit (no params, no session) still resolves
   * to the "not valid" screen, and an `error` param (expired/link used twice)
   * is treated as invalid even if a session lingers.
   */
  useEffect(() => {
    const checkLink = async () => {
      const hasErrorParam = searchParams.has('error')
      const hasCodeOrToken =
        searchParams.has('code') || window.location.hash.includes('access_token')

      const {
        data: { session },
      } = await supabase.auth.getSession()

      setLinkStatus((session && !hasErrorParam) || (hasCodeOrToken && !hasErrorParam) ? 'ok' : 'invalid')
    }
    void checkLink()
  }, [searchParams])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    const unmet = PASSWORD_REQUIREMENTS.filter((req) => !req.test(password))
    if (unmet.length > 0) {
      setError(unmet[0].label)
      return
    }

    setLoading(true)

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })

      if (updateError) throw updateError

      // The recovery link itself created the session. End it so the "sign in
      // with the new password" promise on the next screen is true, and the
      // member authenticates afresh instead of carrying the reset flow's
      // session into the app. signOut resolves to {error} rather than
      // throwing, and a failure here must not hide the fact that the password
      // was changed.
      await supabase.auth.signOut()

      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="space-y-6 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-accent-emerald/10 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8 text-accent-emerald" aria-hidden="true" />
        </div>
        <div>
          <h1 className="font-display text-xl font-semibold text-dark-50">Password updated</h1>
          <p className="mt-2 text-dark-400 text-sm">
            Your new password is live. You can sign in with it now.
          </p>
        </div>
        <Link to="/auth/login" className="block">
          <Button className="w-full" size="lg">
            Go to sign in
          </Button>
        </Link>
      </div>
    )
  }

  if (linkStatus === 'checking') {
    return (
      <div className="space-y-6 text-center animate-fade-in" role="status">
        <PageSpinner size="lg" variant="primary" className="mx-auto" />
        <p className="text-dark-400 text-sm">Checking your reset link…</p>
      </div>
    )
  }

  if (linkStatus === 'invalid') {
    return (
      <div className="space-y-6 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8 text-red-400" aria-hidden="true" />
        </div>
        <div>
          <h1 className="font-display text-xl font-semibold text-dark-50">
            This link is not valid
          </h1>
          <p className="mt-2 text-dark-400 text-sm">
            Password reset links expire after a short time and can only be used once. Request a
            fresh link to continue.
          </p>
        </div>
        <Link to="/auth/forgot-password" className="block">
          <Button className="w-full" size="lg">
            Request a new link
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-primary-600/10 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-8 h-8 text-primary-400" aria-hidden="true" />
        </div>
        <h1 className="font-display text-xl font-semibold text-dark-50">
          Choose a new password
        </h1>
        <p className="mt-2 text-dark-400 text-sm">Pick something you have not used before.</p>
      </div>

      {error && (
        <div
          className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm"
          role="alert"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <div>
        <Label htmlFor="password" required>New password</Label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            className={cn(
              'w-full bg-dark-900 border rounded-xl px-4 py-3 pr-12 text-dark-50 placeholder-dark-500 transition-all duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent',
              'border-dark-700 hover:border-dark-600'
            )}
            placeholder="Enter new password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            aria-describedby="reset-password-requirements"
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-dark-400 hover:text-dark-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            onClick={() => setShowPassword((shown) => !shown)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
          >
            {showPassword ? (
              <EyeOff className="w-5 h-5" aria-hidden="true" />
            ) : (
              <Eye className="w-5 h-5" aria-hidden="true" />
            )}
          </button>
        </div>

        <ul id="reset-password-requirements" className="mt-2 space-y-1" aria-live="polite">
          {PASSWORD_REQUIREMENTS.map((req) => {
            const met = req.test(password)
            return (
              <li
                key={req.id}
                className={cn('flex items-center gap-2 text-xs', met ? 'text-dark-300' : 'text-dark-500')}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'w-2 h-2 rounded-full shrink-0',
                    met ? 'bg-primary-500' : 'bg-dark-600'
                  )}
                />
                <span>{req.label}</span>
                <span className="sr-only">{met ? ' (met)' : ' (not met)'}</span>
              </li>
            )
          })}
        </ul>
      </div>

      <div>
        <Label htmlFor="confirmPassword" required>Confirm new password</Label>
        <div className="relative">
          <input
            id="confirmPassword"
            type={showConfirmPassword ? 'text' : 'password'}
            className={cn(
              'w-full bg-dark-900 border rounded-xl px-4 py-3 pr-12 text-dark-50 placeholder-dark-500 transition-all duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent',
              password !== confirmPassword && confirmPassword.length > 0
                ? 'border-red-500 focus-visible:ring-red-500'
                : 'border-dark-700 hover:border-dark-600'
            )}
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-dark-400 hover:text-dark-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            onClick={() => setShowConfirmPassword((shown) => !shown)}
            aria-label={showConfirmPassword ? 'Hide password confirmation' : 'Show password confirmation'}
            aria-pressed={showConfirmPassword}
          >
            {showConfirmPassword ? (
              <EyeOff className="w-5 h-5" aria-hidden="true" />
            ) : (
              <Eye className="w-5 h-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      <Button type="submit" className="w-full" size="lg" loading={loading}>
        {loading ? 'Updating…' : 'Update password'}
      </Button>

      <p className="text-center text-dark-500 text-sm">
        <Link to="/auth/login" className="text-primary-400 hover:text-primary-300 underline">
          Back to sign in
        </Link>
      </p>
    </form>
  )
}
