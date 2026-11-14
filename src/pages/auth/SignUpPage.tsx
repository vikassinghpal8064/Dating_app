import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react'
import {
  Button,
  Checkbox,
  GoogleButton,
  Input,
  Label,
  PasswordStrengthMeter,
  Select,
} from '../../components/ui'
import {
  PASSWORD_REQUIREMENTS,
  latestDateOfBirth,
  signUpSchema,
  type SignUpInput,
} from '../../utils/validation'
import { useAuth } from '../../lib/authContext'
import { cn } from '../../utils'

const genderOptions = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
]

const interestedInOptions = [
  { value: 'male', label: 'Men' },
  { value: 'female', label: 'Women' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'everyone', label: 'Everyone' },
]

/**
 * Sign-up failures that carry a message worth softening. Everything else is
 * surfaced verbatim so a real problem is never hidden behind a platitude.
 */
function friendlySignUpError(message: string): string {
  const normalised = message.toLowerCase()

  if (normalised.includes('already registered') || normalised.includes('already been registered')) {
    return 'An account with this email already exists. Try signing in instead.'
  }
  // The database trigger that re-checks age raises exactly this sentence.
  if (normalised.includes('18 years old')) {
    return 'You must be at least 18 years old to join HeartConnect.'
  }
  if (normalised.includes('rate limit') || normalised.includes('too many')) {
    return 'Too many attempts right now. Wait a minute and try again.'
  }
  return message
}

export function SignUpPage() {
  const navigate = useNavigate()
  const { signUp } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [serverError, setServerError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      interestedIn: [],
      termsAccepted: false,
      ageConfirmed: false,
    },
  })

  const password = watch('password') ?? ''

  const onSubmit = async (data: SignUpInput) => {
    setIsSubmitting(true)
    setServerError('')

    const { error, requiresEmailVerification } = await signUp({
      email: data.email,
      password: data.password,
      fullName: data.fullName,
      dateOfBirth: data.dateOfBirth,
      gender: data.gender,
      interestedIn: data.interestedIn,
      locationCity: data.locationCity,
      locationCountry: data.locationCountry,
    })

    setIsSubmitting(false)

    if (error) {
      setServerError(friendlySignUpError(error.message))
      return
    }

    // With email confirmation on, GoTrue issues no session: the account exists
    // but nothing is signed in until the link in the inbox is followed.
    if (requiresEmailVerification) {
      navigate(`/auth/verify-email?email=${encodeURIComponent(data.email)}`, { replace: true })
      return
    }

    navigate('/app/discover', { replace: true })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <h1 className="font-display text-2xl font-semibold text-dark-50">
        Create your account
      </h1>

      {serverError && (
        <div
          className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm animate-fade-in"
          role="alert"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          <span>{serverError}</span>
        </div>
      )}

      {/* Personal info */}
      <div className="space-y-6">
        <h2 className="font-display text-xl font-semibold text-dark-50">Personal information</h2>

        <Input
          label="Full name"
          placeholder="Alex Morgan"
          error={errors.fullName?.message}
          {...register('fullName')}
          required
          autoComplete="name"
        />

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
          <Label htmlFor="password" required>Password</Label>
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
              placeholder="Create a strong password"
              {...register('password')}
              required
              aria-invalid={errors.password ? 'true' : undefined}
              aria-describedby="password-requirements"
              autoComplete="new-password"
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
          <PasswordStrengthMeter password={password} />
          <ul id="password-requirements" className="mt-2 space-y-1" aria-live="polite">
            {PASSWORD_REQUIREMENTS.map((req) => {
              const met = req.test(password)
              return (
                <li
                  key={req.id}
                  className={cn('flex items-center gap-2 text-xs', met ? 'text-dark-300' : 'text-dark-500')}
                >
                  <CheckCircle2
                    className={cn('w-3 h-3 flex-shrink-0', met ? 'text-primary-500' : 'text-dark-600')}
                    aria-hidden="true"
                  />
                  <span>{req.label}</span>
                  <span className="sr-only">{met ? ' (met)' : ' (not met)'}</span>
                </li>
              )
            })}
          </ul>
        </div>

        <div>
          <Label htmlFor="confirmPassword" required>Confirm password</Label>
          <div className="relative">
            <input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              className={cn(
                'w-full bg-dark-900 border rounded-xl px-4 py-3 pr-12 text-dark-50 placeholder-dark-500 transition-all duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent',
                errors.confirmPassword
                  ? 'border-red-500 focus-visible:ring-red-500'
                  : 'border-dark-700 hover:border-dark-600'
              )}
              placeholder="Confirm your password"
              {...register('confirmPassword')}
              required
              aria-invalid={errors.confirmPassword ? 'true' : undefined}
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
          {errors.confirmPassword && (
            <p className="mt-1.5 text-sm text-red-400" role="alert">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>
      </div>

      {/* Profile details */}
      <div className="space-y-6 pt-6 border-t border-dark-800">
        <h2 className="font-display text-xl font-semibold text-dark-50">Profile details</h2>

        <Select
          label="Gender"
          placeholder="Select your gender"
          options={genderOptions}
          error={errors.gender?.message}
          {...register('gender')}
          required
        />

        <Input
          label="Date of birth"
          type="date"
          max={latestDateOfBirth()}
          helperText="You must be 18 or older to join."
          error={errors.dateOfBirth?.message}
          {...register('dateOfBirth')}
          required
        />

        <div className="grid sm:grid-cols-2 gap-4">
          <Input
            label="City"
            placeholder="New York"
            error={errors.locationCity?.message}
            {...register('locationCity')}
            required
            autoComplete="address-level2"
          />
          <Input
            label="Country"
            placeholder="United States"
            error={errors.locationCountry?.message}
            {...register('locationCountry')}
            required
            autoComplete="country"
          />
        </div>

        <fieldset>
          <legend className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-dark-300">
            Interested in
            <span className="text-primary-500" aria-hidden="true">*</span>
          </legend>
          <div className="grid sm:grid-cols-2 gap-3">
            {interestedInOptions.map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-3 p-3 bg-dark-900 border rounded-xl cursor-pointer transition-all hover:border-dark-600"
              >
                <input
                  type="checkbox"
                  value={option.value}
                  className="w-4 h-4 rounded border-dark-600 bg-dark-800 text-primary-600 focus:ring-primary-500 focus:ring-2"
                  {...register('interestedIn')}
                />
                <span className="text-dark-100">{option.label}</span>
              </label>
            ))}
          </div>
          {errors.interestedIn && (
            <p className="mt-1.5 text-sm text-red-400" role="alert">
              {errors.interestedIn.message}
            </p>
          )}
        </fieldset>
      </div>

      {/* Consent — two separate agreements, never folded into one */}
      <div className="pt-6 border-t border-dark-800 space-y-3">
        <div className="p-4 bg-dark-900 border rounded-xl space-y-3">
          <Checkbox
            label="I am 18 or older"
            description="HeartConnect is an adults-only service. You must be at least 18 years old to join."
            aria-invalid={errors.ageConfirmed ? 'true' : undefined}
            aria-describedby={errors.ageConfirmed ? 'age-confirm-error' : undefined}
            {...register('ageConfirmed')}
          />
          {errors.ageConfirmed && (
            <p id="age-confirm-error" className="text-sm text-red-400" role="alert">
              {errors.ageConfirmed.message}
            </p>
          )}

          <Checkbox
            label="I accept the Terms and Privacy Policy"
            description="We will never sell your data or phone number."
            aria-invalid={errors.termsAccepted ? 'true' : undefined}
            aria-describedby={errors.termsAccepted ? 'terms-error' : undefined}
            {...register('termsAccepted')}
          />
          {errors.termsAccepted && (
            <p id="terms-error" className="text-sm text-red-400" role="alert">
              {errors.termsAccepted.message}
            </p>
          )}
        </div>
        <p className="text-xs text-dark-500 text-center">
          By creating an account you agree to our{' '}
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

      <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
        {isSubmitting ? 'Creating account…' : 'Create account'}
      </Button>

      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-dark-800" />
        <span className="text-xs text-dark-500">or</span>
        <span className="h-px flex-1 bg-dark-800" />
      </div>

      <GoogleButton />

      <p className="text-center text-dark-500 text-sm">
        Already have an account?{' '}
        <Link to="/auth/login" className="text-primary-400 hover:text-primary-300 font-medium underline">
          Sign in
        </Link>
      </p>
    </form>
  )
}