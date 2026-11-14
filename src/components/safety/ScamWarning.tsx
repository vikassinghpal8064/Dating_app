import { AlertTriangle } from 'lucide-react'

/**
 * ScamWarning component displays a safety warning when a message is flagged
 * as potentially suspicious by the flagSuspiciousMessage function.
 */
export function ScamWarning() {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-warning-500/30 bg-warning-500/10 p-4">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning-400" aria-hidden="true" />
      <div className="flex-1">
        <p className="text-sm font-medium text-warning-100">Safety warning</p>
        <p className="mt-1 text-sm text-warning-200/80">
          This message may be a scam. Never send money or share OTPs.
        </p>
      </div>
    </div>
  )
}
