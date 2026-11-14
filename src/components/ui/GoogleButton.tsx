import { useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { Button } from './Button'
import { supabase } from '../../lib/supabase'
import { getAppOrigin } from '../../lib/appOrigin'

/** The four-colour Google G; lucide ships no brand icons. */
function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 5.04c1.62 0 3.06.56 4.2 1.66l3.12-3.12C17.45 1.8 14.97.75 12 .75 7.72.75 4.02 3.17 2.2 6.85l3.66 2.84C6.83 7.12 9.2 5.04 12 5.04z"
      />
      <path
        fill="#4285F4"
        d="M23.25 12.2c0-.84-.08-1.65-.22-2.43H12v4.6h6.32c-.27 1.48-1.12 2.73-2.36 3.57l3.63 2.82c2.14-1.97 3.66-4.88 3.66-8.56z"
      />
      <path
        fill="#FBBC05"
        d="M5.86 14.31c-.27-.78-.42-1.62-.42-2.49s.15-1.71.42-2.49L2.2 6.49C1.42 7.99 1 9.34 1 11.82s.42 3.83 1.2 5.33l3.66-2.84z"
      />
      <path
        fill="#34A853"
        d="M12 23.25c3.03 0 5.58-1 7.43-2.71l-3.63-2.82c-1.03.7-2.34 1.12-3.8 1.12-2.8 0-5.17-2.08-5.14-4.62l-3.66 2.84c1.8 3.68 5.5 6.19 9.8 6.19z"
      />
    </svg>
  )
}

function friendlyOAuthError(message: string): string {
  const normalised = message.toLowerCase()
  if (normalised.includes('not enabled') || normalised.includes('unsupported provider')) {
    return 'Google sign-in is not available right now. Please use email and password.'
  }
  return message
}

/**
 * "Continue with Google" for the auth forms.
 *
 * Self-contained: it owns its loading and error state, so the forms only place
 * it under their own divider. The callback landmark is the fixed relative path
 * `/auth/callback`, which the router maps to the exchange page.
 */
export function GoogleButton() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const continueWithGoogle = async () => {
    setError('')
    setLoading(true)

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${getAppOrigin()}/auth/callback` },
    })

    setLoading(false)

    if (oauthError) {
      setError(friendlyOAuthError(oauthError.message))
    }
  }

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        size="lg"
        loading={loading}
        onClick={() => void continueWithGoogle()}
      >
        <GoogleIcon />
        Continue with Google
      </Button>
      {error && (
        <div
          className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm animate-fade-in"
          role="alert"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}