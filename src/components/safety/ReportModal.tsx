import { useState } from 'react'
import { AlertTriangle, Check } from 'lucide-react'
import { Modal, Button, Label, Textarea, InlineMessage } from '../ui'
import { reportUser, blockUser, type ReportReason } from '../../lib/safety'

interface ReportModalProps {
  isOpen: boolean
  onClose: () => void
  reportedUserId: string
  reportedUserName: string
  onReportAndBlock?: () => void
}

const REASONS: Array<{ value: ReportReason; label: string }> = [
  { value: 'fake_profile', label: 'Fake profile' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'scam', label: 'Scam or suspicious behaviour' },
  { value: 'inappropriate_photos', label: 'Inappropriate photos' },
  { value: 'underage', label: 'Underage user' },
  { value: 'solicitation', label: 'Solicitation or spam' },
  { value: 'other', label: 'Other' },
]

export function ReportModal({
  isOpen,
  onClose,
  reportedUserId,
  reportedUserName,
  onReportAndBlock,
}: ReportModalProps) {
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [details, setDetails] = useState('')
  const [alsoBlock, setAlsoBlock] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!reason) {
      setError('Please select a reason.')
      return
    }

    setSubmitting(true)
    setError(null)

    const { error: reportError } = await reportUser({
      reportedId: reportedUserId,
      reason,
      details: details.trim() || undefined,
    })

    if (reportError) {
      setError(reportError)
      setSubmitting(false)
      return
    }

    if (alsoBlock) {
      const { error: blockError } = await blockUser(reportedUserId)
      if (blockError) {
        console.error('Failed to block user:', blockError)
      }
      if (onReportAndBlock) {
        onReportAndBlock()
      }
    }

    setSubmitted(true)
    setSubmitting(false)
  }

  const handleClose = () => {
    setReason(null)
    setDetails('')
    setAlsoBlock(false)
    setSubmitted(false)
    setError(null)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Report user">
      {submitted ? (
        <div className="space-y-4 py-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-500/20">
            <Check className="h-6 w-6 text-primary-500" />
          </div>
          <h2 className="font-display text-xl font-semibold text-dark-50">Thank you</h2>
          <p className="text-sm text-dark-400">
            Your report has been submitted. Our team will review it shortly.
          </p>
          <Button onClick={handleClose} className="w-full">
            Close
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-xl border border-warning-500/30 bg-warning-500/10 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning-400" />
              <div className="text-sm text-warning-100">
                <p className="font-medium">Report {reportedUserName}</p>
                <p className="mt-1 text-warning-200/80">
                  We take all reports seriously. Your report will be reviewed by our safety team.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>What&apos;s the issue?</Label>
            <div className="space-y-2">
              {REASONS.map((r) => (
                <label
                  key={r.value}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-dark-700 bg-dark-900 px-4 py-3 transition-colors hover:border-dark-600 hover:bg-dark-800"
                >
                  <input
                    type="radio"
                    name="reason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={() => setReason(r.value)}
                    className="h-4 w-4 text-primary-500 focus:ring-primary-500"
                  />
                  <span className="text-sm text-dark-100">{r.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="details">Additional details (optional)</Label>
            <Textarea
              id="details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Tell us more about what happened…"
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-dark-500">{details.length}/500</p>
          </div>

          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dark-700 bg-dark-900 px-4 py-3">
            <input
              type="checkbox"
              checked={alsoBlock}
              onChange={(e) => setAlsoBlock(e.target.checked)}
              className="h-4 w-4 rounded border-dark-700 text-primary-500 focus:ring-primary-500"
            />
            <span className="text-sm text-dark-100">Also block this person</span>
          </label>

          {error && <InlineMessage tone="error">{error}</InlineMessage>}

          <div className="flex gap-3">
            <Button variant="outline" onClick={handleClose} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={submitting} disabled={!reason} className="flex-1">
              Submit report
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
