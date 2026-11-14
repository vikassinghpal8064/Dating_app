import { useState } from 'react'
import { Ban, Flag, ShieldAlert } from 'lucide-react'
import { Avatar, Button, Modal, Select, Textarea } from '../ui'
import type { Database } from '../../types/database'
import type { SearchProfile } from '../../types'

type ReportReason = Database['public']['Enums']['report_reason']
type Step = 'menu' | 'report' | 'block'

const REASON_LABELS: Record<ReportReason, string> = {
  fake_profile: 'Fake profile',
  harassment: 'Harassment or bullying',
  scam: 'Scam or suspicious behaviour',
  inappropriate_photos: 'Inappropriate photos',
  underage: 'Underage user',
  solicitation: 'Solicitation or spam',
  other: 'Other',
}

const REASON_OPTIONS = (Object.keys(REASON_LABELS) as ReportReason[]).map((value) => ({
  value,
  label: REASON_LABELS[value],
}))

interface CardActionsProps {
  profile: SearchProfile
  open: boolean
  onClose: () => void
  /** Fires after a valid report is submitted (page records it + consumes card). */
  onReport: (reason: ReportReason, details: string) => Promise<void>
  /** Fires when the member confirms the two-way block. */
  onBlock: () => Promise<void>
}

/**
 * The ⋯ overflow menu on a deck card: File a report, or block this member.
 * Blocking is two-way and permanent — the confirm step says so out loud.
 */
export function CardActions({ profile, open, onClose, onReport, onBlock }: CardActionsProps) {
  const [step, setStep] = useState<Step>('menu')
  const [reason, setReason] = useState<ReportReason | ''>('')
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const goBackToMenu = () => {
    setStep('menu')
    setError(null)
  }

  const submitReport = async () => {
    if (!reason) {
      setError('Choose a reason for the report.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onReport(reason, details)
      resetAndClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The report could not be sent.')
      setSubmitting(false)
    }
  }

  const confirmBlock = async () => {
    setSubmitting(true)
    setError(null)
    try {
      await onBlock()
      resetAndClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The member could not be blocked.')
      setSubmitting(false)
    }
  }

  const resetAndClose = () => {
    setStep('menu')
    setReason('')
    setDetails('')
    setError(null)
    setSubmitting(false)
    onClose()
  }

  return (
    <Modal
      isOpen={open}
      onClose={resetAndClose}
      size="sm"
      title={step === 'menu' ? undefined : step === 'report' ? 'Report member' : 'Block member'}
    >
      {step === 'menu' && (
        <div className="space-y-2">
          <p className="flex items-center gap-3 rounded-xl border border-dark-800 bg-dark-900/60 p-3">
            <Avatar fallback={profile.full_name} size="md" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-dark-100">
                {profile.full_name}, {profile.age}
              </span>
              <span className="block text-xs text-dark-500">{profile.location_city}</span>
            </span>
          </p>

          <button
            type="button"
            onClick={() => setStep('report')}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-dark-100 transition-colors hover:bg-dark-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <Flag className="h-5 w-5 text-primary-400" aria-hidden="true" />
            Report {profile.full_name}
            <span className="ml-auto text-xs text-dark-500">We keep this private</span>
          </button>

          <button
            type="button"
            onClick={() => setStep('block')}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <Ban className="h-5 w-5" aria-hidden="true" />
            Block {profile.full_name}
          </button>
        </div>
      )}

      {step === 'report' && (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            void submitReport()
          }}
        >
          <div className="flex items-start gap-3 rounded-xl border border-primary-500/20 bg-primary-600/10 p-3 text-sm text-primary-200">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <p>
              Nobody ever finds out you reported them. Our team reviews every report
              before anything happens.
            </p>
          </div>

          <Select
            label="Reason"
            placeholder="Choose a reason"
            options={REASON_OPTIONS}
            value={reason}
            onChange={(event) => setReason(event.target.value as ReportReason | '')}
          />

          <Textarea
            label="Details (optional)"
            helperText="Anything that helps our team understand what happened."
            rows={4}
            maxLength={2000}
            value={details}
            onChange={(event) => setDetails(event.target.value)}
          />

          {error && (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-3 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={goBackToMenu}>
              Back
            </Button>
            <Button type="submit" size="sm" loading={submitting}>
              Submit report
            </Button>
          </div>
        </form>
      )}

      {step === 'block' && (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-dark-300">
            Blocking <span className="font-medium text-dark-100">{profile.full_name}</span> is{' '}
            <span className="font-medium text-red-400">permanent</span>. You won&rsquo;t see each
            other in Search, Discover or matches, and they won&rsquo;t see you either.
          </p>

          {error && (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-3">
            <Button type="button" variant="ghost" size="sm" onClick={goBackToMenu}>
              Cancel
            </Button>
            <button
              type="button"
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:opacity-50"
              onClick={() => void confirmBlock()}
            >
              {submitting ? 'Blocking...' : 'Block member'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}