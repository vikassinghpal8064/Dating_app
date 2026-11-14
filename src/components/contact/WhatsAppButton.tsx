import { useCallback, useEffect, useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/authContext'
import { useToast } from '../ui/toastContext'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { cn } from '../../utils'

interface WhatsAppButtonProps {
  /** The member whose number is being asked for. */
  targetUserId: string
  /** The target's display name, for the safety prompt and request copy. */
  name?: string
  /**
   * Whether the target's consent mode invites requests ('approved'). Only when
   * true does a denial offer the "Request WhatsApp" path.
   */
  canRequest?: boolean
  className?: string
}

/**
 * The consent-gated WhatsApp handover button.
 *
 * No number ever sits in this component, in any bundle, or in any network
 * request before the click: pressing it calls the consent-checking
 * `get_contact_link` RPC, and only the RPC's return value becomes a link. A
 * null return — stranger, 'never' mode, or a block in either direction — is
 * rendered as "has not shared", never as the reason. For an 'approved'-mode
 * target the same denial can turn into a request via `request_contact`.
 *
 * The safety prompt appears once per target per page load (module-level, never
 * persisted — honesty here beats convenience). After the first confirmation the
 * link opens straight to wa.me.
 */
export function WhatsAppButton({
  targetUserId,
  name,
  canRequest = false,
  className,
}: WhatsAppButtonProps) {
  const { user } = useAuth()
  const toast = useToast()

  const [busy, setBusy] = useState(false)
  const [releasedNumber, setReleasedNumber] = useState<string | null>(null)
  const [safetyOpen, setSafetyOpen] = useState(false)
  const [denied, setDenied] = useState(false)
  const [alreadyPending, setAlreadyPending] = useState(false)
  const [sent, setSent] = useState(false)

  // A prior pending request to this target is a fact worth showing, but only
  // when the page may offer requests at all.
  useEffect(() => {
    if (!canRequest || !user) return
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase
        .from('contact_requests')
        .select('status')
        .eq('requester_id', user.id)
        .eq('owner_id', targetUserId)
        .maybeSingle()
      if (!cancelled && !error && data?.status === 'pending') setAlreadyPending(true)
    })()
    return () => {
      cancelled = true
    }
  }, [canRequest, user, targetUserId])

  const openWhatsApp = useCallback((number: string) => {
    window.open(`https://wa.me/${number}`, '_blank', 'noopener,noreferrer')
  }, [])

  const handleClick = useCallback(async () => {
    if (busy || !user) return
    setBusy(true)
    const { data, error } = await supabase.rpc('get_contact_link', {
      target_user_id: targetUserId,
    })
    setBusy(false)

    if (error) {
      toast.addToast({
        title: 'That could not be checked',
        description: error.message,
        type: 'error',
      })
      return
    }

    if (data) {
      // One safety prompt per target per session; afterwards, straight through.
      if (safetyConfirmedFor.has(targetUserId)) {
        openWhatsApp(data)
        return
      }
      setReleasedNumber(data)
      setSafetyOpen(true)
      return
    }

    setDenied(true)
  }, [busy, user, targetUserId, toast, openWhatsApp])

  const confirmSafety = useCallback(() => {
    if (!releasedNumber) return
    safetyConfirmedFor.add(targetUserId)
    openWhatsApp(releasedNumber)
    setSafetyOpen(false)
  }, [releasedNumber, targetUserId, openWhatsApp])

  const sendRequest = useCallback(async () => {
    if (busy) return
    setBusy(true)
    const { error } = await supabase.rpc('request_contact', { p_owner: targetUserId })
    setBusy(false)

    if (error) {
      toast.addToast({
        title: 'Request could not be sent',
        description: error.message,
        type: 'error',
      })
      return
    }
    setSent(true)
  }, [busy, targetUserId, toast])

  const hasOpenRequest = alreadyPending || sent

  return (
    <div className={cn('flex flex-col items-stretch gap-3', className)}>
      <Button
        type="button"
        variant="outline"
        onClick={() => void handleClick()}
        loading={busy}
        aria-label={name ? `Chat on WhatsApp with ${name}` : 'Chat on WhatsApp'}
      >
        <MessageCircle className="h-4 w-4" aria-hidden="true" />
        WhatsApp
      </Button>

      {denied && (
        <div
          className="rounded-xl border border-dark-700 bg-dark-900/60 p-3 text-sm text-dark-300"
          data-testid="whatsapp-denied"
        >
          <p className="font-medium text-dark-200">This person has not shared their WhatsApp</p>
          {canRequest ? (
            hasOpenRequest ? (
              <p className="mt-1 text-primary-300">Request sent — they can approve it from Settings.</p>
            ) : (
              <>
                <p className="mt-1">You can ask for their number and they approve it on their side.</p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  onClick={() => void sendRequest()}
                  loading={busy}
                >
                  Request WhatsApp
                </Button>
              </>
            )
          ) : (
            <p className="mt-1 text-dark-500">
              If you match, they may release it from their settings.
            </p>
          )}
        </div>
      )}

      <Modal
        isOpen={safetyOpen}
        onClose={() => setSafetyOpen(false)}
        title="Meet in public, stay safe"
        description={name ? `You're opening WhatsApp to chat with ${name}.` : "You're opening WhatsApp."}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-dark-300">
            Meet in busy public places, tell someone where you&apos;re going, and never send money or
            gift codes to someone you have not met. If anything feels off, report it from their
            profile.
          </p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setSafetyOpen(false)}>
              Not now
            </Button>
            <Button onClick={confirmSafety}>Open WhatsApp</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

/**
 * One confirmation per target per page load. Deliberately not persisted: a
 * fresh visit re-shows the prompt, which is the honest default for a feature
 * that hands out phone numbers.
 */
const safetyConfirmedFor = new Set<string>()