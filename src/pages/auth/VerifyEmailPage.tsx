import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertCircle, CheckCircle2, Mail, RefreshCw } from 'lucide-react'
import { Button } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import { cn } from '../../utils'

type Status = 'verifying' | 'success' | 'error' | 'idle'

const RESEND_COOLDOWN_SECONDS = 60

/** The six-digit code a member may have typed in by hand. */
const SIX_DIGIT_CODE = /^\d{6}$/

/**
 * Reads the callback out of the URL once.
 *
 * Under PKCE, Supabase redirects with a `code` that has to be exchanged for a
 * session. The client also has `detectSessionInUrl` on, so a valid `code` may
 * already have been spent by the time this component mounts — hence the session
 * check in `verify` before trying to exchange it a second time.
 */
function readCallback(search: URLSearchParams) {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  return {
    code: search.get('code') ?? hash.get('code'),
    token: search.get('token') ?? hash.get('token'),
    errorDescription: search.get('error_description'),
    errorCode: search.get('error') ?? hash.get('error'),
  }
}

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [resending, setResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  const email = searchParams.get('email')
  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (cooldownTimer.current) clearInterval(cooldownTimer.current)
    }
  }, [])

  useEffect(() => {
    const { code, token, errorDescription, errorCode } = readCallback(searchParams)

    if (errorCode) {
      setStatus('error')
      setError(errorDescription ?? 'The verification link is invalid or has expired.')
      return
    }

    if (code) {
      void verify(code, null)
    } else if (token && SIX_DIGIT_CODE.test(token) && email) {
      void verify(null, { email, token })
    } else if (email) {
      setStatus('idle')
    } else {
      setStatus('error')
      setError(
        'This page needs a verification link. Request a new one from the sign-up screen.'
      )
    }
  }, [searchParams, email])

  async function verify(code: string | null, otp: { email: string; token: string } | null) {
    setStatus('verifying')

    // `detectSessionInUrl` may already have exchanged the code.
    const { data: existing } = await supabase.auth.getSession()
    if (existing.session) {
      setStatus('success')
      return
    }

    const { error: verifyError } = otp
      ? await supabase.auth.verifyOtp({ email: otp.email, token: otp.token, type: 'email' })
      : await supabase.auth.exchangeCodeForSession(code as string)

    if (verifyError) {
      setStatus('error')
      setError(verifyError.message)
      return
    }

    setStatus('success')
  }

  async function resendEmail() {
    if (resendCooldown > 0) return

    setResending(true)
    setError('')

    if (!email) {
      setResending(false)
      setError('We do not know which email to resend to. Sign in and request a new link.')
      return
    }

    const { error: resendError } = await supabase.auth.resend({ type: 'signup', email })

    setResending(false)

    if (resendError) {
      setError(resendError.message)
      return
    }

    setResendCooldown(RESEND_COOLDOWN_SECONDS)
    cooldownTimer.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownTimer.current) clearInterval(cooldownTimer.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  if (status === 'verifying') {
    return (
      <div className="space-y-6 text-center animate-fade-in" role="status">
        <div className="w-16 h-16 rounded-full bg-primary-600/10 flex items-center justify-center mx-auto">
          <RefreshCw className="w-8 h-8 text-primary-400 animate-spin" aria-hidden="true" />
        </div>
        <div>
          <h1 className="font-display text-xl font-semibold text-dark-50">
            Verifying your email
          </h1>
          <p className="mt-2 text-dark-400 text-sm">One moment while we check your link.</p>
        </div>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="space-y-6 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-accent-emerald/10 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8 text-accent-emerald" aria-hidden="true" />
        </div>
        <div>
          <h1 className="font-display text-xl font-semibold text-dark-50">
            Email verified
          </h1>
          <p className="mt-2 text-dark-400 text-sm">
            {email
              ? `${email} is confirmed. You are signed in.`
              : 'Your address is confirmed and you are signed in.'}
          </p>
        </div>
        <Link to="/app/discover" className="block">
          <Button className="w-full" size="lg">
            Go to Discover
          </Button>
        </Link>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="space-y-6 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8 text-red-400" aria-hidden="true" />
        </div>
        <div>
          <h1 className="font-display text-xl font-semibold text-dark-50">
            That link did not work
          </h1>
          <p className="mt-2 text-dark-400 text-sm" role="alert">
            {error}
          </p>
        </div>

        {email ? (
          <Button
            className="w-full"
            size="lg"
            onClick={() => void resendEmail()}
            loading={resending}
            disabled={resendCooldown > 0}
          >
            <Mail className="w-5 h-5" aria-hidden="true" />
            {resendCooldown > 0
              ? `Resend available in ${resendCooldown}s`
              : 'Send the link again'}
          </Button>
        ) : (
          <Link to="/auth/signup" className="block">
            <Button className="w-full" size="lg">
              Back to sign up
            </Button>
          </Link>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6 text-center animate-fade-in">
      <div className="w-16 h-16 rounded-full bg-primary-600/10 flex items-center justify-center mx-auto">
        <Mail className="w-8 h-8 text-primary-400" aria-hidden="true" />
      </div>
      <div>
        <h1 className="font-display text-xl font-semibold text-dark-50">
          Check your email
        </h1>
        <p className="mt-2 text-dark-400 text-sm">
          {email ? (
            <>
              We sent a confirmation link to{' '}
              <span className="text-dark-100">{email}</span>. Open it to finish creating your
              account.
            </>
          ) : (
            'Open the confirmation link we emailed you to finish creating your account.'
          )}
        </p>
      </div>

      {email && (
        <Button
          className="w-full"
          size="lg"
          variant="outline"
          onClick={() => void resendEmail()}
          loading={resending}
          disabled={resendCooldown > 0}
        >
          <RefreshCw className="w-5 h-5" aria-hidden="true" />
          {resendCooldown > 0
            ? `Resend available in ${resendCooldown}s`
            : 'Resend confirmation email'}
        </Button>
      )}

      <p className={cn('text-center text-dark-500 text-sm')}>
        <Link to="/auth/login" className="text-primary-400 hover:text-primary-300 underline">
          Back to sign in
        </Link>
      </p>
    </div>
  )
}
