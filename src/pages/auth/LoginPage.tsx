import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Eye, EyeOff } from 'lucide-react'
import { Button, Input, Label } from '../../components/ui'
import { signInSchema, type SignInInput } from '../../utils/validation'
import { useAuth } from '../../lib/authContext'
import { cn } from '../../utils'

/**
 * Supabase returns deliberately vague messages for bad credentials. Anything
 * else (a locked account, a rate limit, an outage) is surfaced as-is, because
 * hiding it would leave the user with no idea what went wrong.
 */
function friendlyAuthError(message: string): string {
  const normalised = message.toLowerCase()

  if (normalised.includes('invalid login credentials')) {
    return 'That email and password combination does not match an account.'
  }
  if (normalised.includes('email not confirmed')) {
    return 'Confirm your email address first — check your inbox for the verification link.'
  }
  if (normalised.includes('rate limit') || normalised.includes('too many')) {
    return 'Too many attempts. Wait a minute and try again.'
  }
  return message
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
  })

  const onSubmit = async (data: SignInInput) => {
    setIsSubmitting(true)
    setServerError('')

    const { error } = await signIn(data.email, data.password)

    setIsSubmitting(false)

    if (error) {
      setServerError(friendlyAuthError(error.message))
      return
    }

    // `ProtectedRoute` records where the visitor was heading before bouncing
    // them here. Only same-origin absolute paths are honoured, so a crafted
    // `from` value can never turn this into an open redirect.
    const from =
      (location.state as { from?: string } | null)?.from ?? '/app/discover'

    const safeFrom = from.startsWith('/') && !from.startsWith('//') ? from : '/app/discover'

    navigate(safeFrom, { replace: true })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <h1 className="font-display text-2xl font-semibold text-dark-50">Sign in</h1>

      {serverError && (
        <div
          className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm animate-fade-in"
          role="alert"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          <span>{serverError}</span>
        </div>
      )}

      <div className="space-y-4">
        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          error={errors.email?.message}
          {...register('email')}
          required
          autoComplete="email"
        />

        <div>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <Label htmlFor="password" required className="mb-0">Password</Label>
            <Link
              to="/auth/forgot-password"
              className="text-sm text-primary-400 hover:text-primary-300 underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              className={cn(
                'w-full bg-dark-900 border rounded-xl px-4 py-3 pr-12 text-dark-50 placeholder-dark-500 transition-all duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent',
                errors.password
                  ? 'border-red-500 focus-visible:ring-red-500'
                  : 'border-dark-700 hover:border-dark-600'
              )}
              placeholder="Enter your password"
              {...register('password')}
              required
              aria-invalid={errors.password ? 'true' : undefined}
              autoComplete="current-password"
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
          {errors.password && (
            <p className="mt-1.5 text-sm text-red-400" role="alert">
              {errors.password.message}
            </p>
          )}
        </div>
      </div>

      <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </Button>

      <p className="text-center text-dark-500 text-sm">
        New here?{' '}
        <Link to="/auth/signup" className="text-primary-400 hover:text-primary-300 font-medium underline">
          Create a free account
        </Link>
      </p>
    </form>
  )
}
