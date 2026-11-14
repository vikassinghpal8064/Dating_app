import { useState } from 'react'
import { AlertCircle, X } from 'lucide-react'

export function SafetyBanner() {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <div className="relative rounded-xl border border-warning-500/30 bg-warning-500/10 px-4 py-3">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-warning-400" aria-hidden="true" />
        <div className="flex-1 text-sm">
          <p className="font-medium text-warning-100">Stay safe</p>
          <ul className="mt-1 space-y-1 text-warning-200/80">
            <li>• Meet in public places for the first few dates</li>
            <li>• Never send money to someone you haven&apos;t met</li>
            <li>• Report suspicious behaviour immediately</li>
          </ul>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="shrink-0 rounded-lg p-1 text-warning-400 transition-colors hover:bg-warning-500/20 hover:text-warning-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning-500"
          aria-label="Dismiss safety tips"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
