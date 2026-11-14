import { useCallback, useState } from 'react'
import { Inbox } from 'lucide-react'
import { useContactRequests, type IncomingContactRequest } from '../../hooks/useContactRequests'
import { Button } from '../ui/Button'

function whenLabel(createdAt: string): string {
  const date = new Date(createdAt)
  const today = new Date()
  const sameDay = date.toDateString() === today.toDateString()
  return sameDay
    ? `Today, ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

/**
 * The incoming WhatsApp-number requests, one row per requester.
 *
 * Reads through RLS as the owner (only requests answered *to* the signed-in
 * member ever come back), and answering goes through the owner-only
 * `respond_contact_request` function — approving also writes the per-viewer
 * grant, so there is no window where the button says "approved" but the
 * release gate has not been opened.
 */
export function RequestsList() {
  const { data, status, respond } = useContactRequests()
  const [busyId, setBusyId] = useState<string | null>(null)

  const rows = data ?? []
  const pending = rows.filter((row) => row.status === 'pending')
  const answered = rows.filter((row) => row.status !== 'pending')

  const respondTo = useCallback(
    async (request: IncomingContactRequest, approve: boolean) => {
      setBusyId(request.id)
      await respond(request.id, approve)
      setBusyId(null)
    },
    [respond]
  )

  return (
    <section className="glass rounded-2xl p-5">
      <h2 className="font-display text-lg font-semibold text-dark-100">WhatsApp requests</h2>
      <p className="mt-1 text-sm text-dark-400">
        People who asked for your number because you chose “Only after I approve them”.
      </p>

      {status === 'loading' && rows.length === 0 ? (
        <p className="mt-4 text-sm text-dark-500" aria-busy="true">
          Loading requests…
        </p>
      ) : pending.length === 0 && answered.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-2 rounded-xl border border-dashed border-dark-700 py-8 text-center">
          <Inbox className="h-8 w-8 text-dark-600" aria-hidden="true" />
          <p className="text-sm text-dark-500">Nothing to answer yet.</p>
        </div>
      ) : (
        <ul className="mt-4 space-y-3" data-testid="requests-list">
          {pending.map((request) => (
            <li
              key={request.id}
              className="rounded-xl border border-dark-700 bg-dark-900/60 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-dark-100">
                    {request.requesterName ?? 'A member'}
                  </p>
                  <p className="text-xs text-dark-500">{whenLabel(request.createdAt)}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={busyId === request.id}
                    onClick={() => void respondTo(request, false)}
                    aria-label={`Decline ${request.requesterName ?? 'the requester'}'s request`}
                  >
                    Decline
                  </Button>
                  <Button
                    size="sm"
                    loading={busyId === request.id}
                    onClick={() => void respondTo(request, true)}
                    aria-label={`Approve ${request.requesterName ?? 'the requester'}'s request`}
                  >
                    Approve
                  </Button>
                </div>
              </div>
            </li>
          ))}

          {answered.length > 0 && (
            <li className="pt-2">
              <p className="text-xs font-medium uppercase tracking-wide text-dark-500">
                Answered • {answered.length}
              </p>
              <ul className="mt-2 space-y-2">
                {answered.map((request) => (
                  <li
                    key={request.id}
                    className="flex items-center justify-between rounded-xl border border-dark-800 px-4 py-3 text-sm"
                  >
                    <span className="text-dark-300">{request.requesterName ?? 'A member'}</span>
                    <span
                      className={
                        request.status === 'approved' ? 'text-primary-300' : 'text-dark-500'
                      }
                    >
                      {request.status === 'approved' ? 'Approved' : 'Declined'}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          )}
        </ul>
      )}
    </section>
  )
}