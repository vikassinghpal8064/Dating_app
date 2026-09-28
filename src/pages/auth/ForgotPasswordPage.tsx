import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, ArrowLeft, Mail, Send } from 'lucide-react'
import { Button, Input } from '../../components/ui'
import { useAuth } from '../../lib/authContext'
import { isValidEmail } from '../../utils'

export function ForgotPasswordPage() {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setFieldError('')

    if (!isValidEmail(email)) {
      setFieldError('Enter a valid email address.')
      return
    }

    setLoading(true)

    const { error: resetError } = await resetPassword(email)
    setLoading(false)

    if (resetError) {
      setError(resetError.message)
      return
    }

    setSent(true)
  }

  if (sent) {
    return (
      <div className="space-y-6 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-primary-600/10 flex items-center justify-center mx-auto">
          <Mail className="w-8 h-8 text-primary-400" aria-hidden="true" />
        </div>
        <div>
          <h1 className="font-display text-xl font-semibold text-dark-50">Check your inbox</h1>
          <p className="mt-2 text-dark-400 text-sm">
            If an account exists for <strong className="text-dark-200">{email}</strong>, a reset link
            is on its way. The link expires shortly for your safety.
          </p>
        </div>
        <Link to="/auth/login" className="block">
          <Button variant="outline" className="w-full">
            <ArrowLeft className="w-4 h-4 mr-2" aria-hidden="true" />
            Back to sign in
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <div className="text-center">
        <h1 className="font-display text-xl font-semibold text-dark-50">Reset your password</h1>
        <p className="mt-2 text-dark-400 text-sm">
          Enter the email you signed up with and we will send you a reset link.
        </p>
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

      <Input
        label="Email"
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value)
          if (fieldError) setFieldError('')
        }}
        error={fieldError}
        required
        autoComplete="email"
      />

      <Button type="submit" className="w-full" size="lg" loading={loading}>
        {!loading && <Send className="w-4 h-4 mr-2" aria-hidden="true" />}
        {loading ? 'Sending…' : 'Send reset link'}
      </Button>

      <p className="text-center text-dark-500 text-sm">
        <Link to="/auth/login" className="text-primary-400 hover:text-primary-300 underline">
          Back to sign in
        </Link>
      </p>
    </form>
  )
}
