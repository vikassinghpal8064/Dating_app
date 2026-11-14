import { useCallback, useEffect, useState } from 'react'
import { PhoneOff, ShieldAlert } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/authContext'
import { useToast } from '../ui/toastContext'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { normalizeToE164, dialCodeHint } from '../../utils/phoneUtils'

type ContactShareMode = 'never' | 'matches' | 'approved'

const SHARE_MODE_OPTIONS: readonly { value: string; label: string }[] = [
  { value: 'never', label: 'No one' },
  { value: 'matches', label: 'People I match with' },
  { value: 'approved', label: 'Only after I approve them' },
]

const MODE_EXPLANATION: Record<ContactShareMode, string> = {
  never: 'Your number is never shown to anyone, and no one can request it.',
  matches: 'Your number is released to people you match with — no approval step.',
  approved:
    'Others can request your number, and you approve each request individually from here.',
}

/**
 * The owner's WhatsApp contact settings: their number and who may have it.
 *
 * The number is read from and written to `private_contacts` — the only table
 * in the schema allowed to hold one — and nothing here ever renders it inside
 * another member's page. The revoke button goes all the way through the
 * database function, so revoking also deletes every existing grant.
 */
export function ContactSettings() {
  const { user } = useAuth()
  const toast = useToast()

  const [number, setNumber] = useState('')
  const [mode, setMode] = useState<ContactShareMode>('never')
  const [hasRow, setHasRow] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmRevoke, setConfirmRevoke] = useState(false)

  const refresh = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('private_contacts')
      .select('whatsapp_number, share_mode')
      .eq('user_id', user.id)
      .maybeSingle()
    setHasRow(Boolean(data))
    setNumber(data?.whatsapp_number ?? '')
    setMode((data?.share_mode as ContactShareMode | undefined) ?? 'never')
    setLoading(false)
  }, [user])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const handleSave = useCallback(async () => {
    if (!user || busy) return
    setBusy(true)
    setError('')

    const normalized = normalizeToE164(number)

    let saveError: string | null = null
    if (mode !== 'never' && !normalized) {
      setError('Enter a full number with your country code, e.g. +91 98765 43210.')
    } else if (mode === 'never' && !normalized) {
      // Nothing to release and nothing new to store. If a stale number is on
      // file, remove it so it cannot resurface under a future share mode.
      if (hasRow) {
        const { error: deleteError } = await supabase
          .from('private_contacts')
          .delete()
          .eq('user_id', user.id)
        saveError = deleteError?.message ?? null
      }
    } else {
      const { error: upsertError } = await supabase.from('private_contacts').upsert({
        user_id: user.id,
        whatsapp_number: normalized as string,
        share_mode: mode,
      })
      saveError = upsertError?.message ?? null
    }

    setBusy(false)
    if (saveError) {
      toast.addToast({ title: 'Could not be saved', description: saveError, type: 'error' })
      return
    }
    toast.addToast({
      title: mode === 'never' ? 'WhatsApp sharing turned off' : 'Contact settings saved',
      type: 'success',
    })
    await refresh()
  }, [user, busy, number, mode, hasRow, toast, refresh])

  const handleRemove = useCallback(async () => {
    if (!user || busy) return
    setBusy(true)
    const { error: deleteError } = await supabase.from('private_contacts').delete().eq('user_id', user.id)
    setBusy(false)
    if (deleteError) {
      toast.addToast({ title: 'Could not be removed', description: deleteError.message, type: 'error' })
      return
    }
    setConfirmRevoke(false)
    toast.addToast({ title: 'Number removed', description: 'No one can request it now.', type: 'success' })
    await refresh()
  }, [user, busy, toast, refresh])

  const handleRevokeAll = useCallback(async () => {
    if (!user || busy) return
    setBusy(true)
    const { error: rpcError } = await supabase.rpc('revoke_all_contact_access')
    setBusy(false)
    if (rpcError) {
      toast.addToast({ title: 'Could not be revoked', description: rpcError.message, type: 'error' })
      return
    }
    setConfirmRevoke(false)
    toast.addToast({
      title: 'Access revoked for everyone',
      description: 'Your number is now set to “No one” until you change it.',
      type: 'success',
    })
    await refresh()
  }, [user, busy, toast, refresh])

  if (loading) {
    return (
      <section className="glass rounded-2xl p-5" aria-busy="true">
        <p className="text-sm text-dark-400">Loading contact settings…</p>
      </section>
    )
  }

  return (
    <section className="glass rounded-2xl p-5">
      <h2 className="font-display text-lg font-semibold text-dark-100">WhatsApp contact</h2>
      <p className="mt-1 text-sm text-dark-400">
        Your number is kept separate from your profile and is only released to the people you
        choose, one released number at a time.
      </p>

      <div className="mt-4 space-y-4">
        <Input
          id="contact-settings-number"
          label="WhatsApp number"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={number}
          placeholder="+91 98765 43210"
          helperText={dialCodeHint()}
          error={error || undefined}
          onChange={(event) => {
            setNumber(event.target.value)
            if (error) setError('')
          }}
        />

        <Select
          id="contact-settings-mode"
          label="Who can have it"
          options={SHARE_MODE_OPTIONS}
          value={mode}
          onChange={(event) => setMode(event.target.value as ContactShareMode)}
        />
        <p className="text-sm text-dark-500">{MODE_EXPLANATION[mode]}</p>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button onClick={() => void handleSave()} loading={busy}>
            Save contact settings
          </Button>
          {hasRow && (
            <Button variant="ghost" onClick={() => void handleRemove()} loading={busy}>
              Remove number
            </Button>
          )}
        </div>

        <div className="border-t border-dark-800 pt-4">
          {confirmRevoke ? (
            <div className="rounded-xl border border-red-900/60 bg-red-950/30 p-3 text-sm">
              <p className="font-medium text-red-300">
                This removes your number from everyone you approved.
              </p>
              <p className="mt-1 text-dark-400">
                They will not be able to open your WhatsApp link anymore. Your number stays saved,
                set to “No one”.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Button variant="ghost" size="sm" onClick={() => setConfirmRevoke(false)}>
                  Keep access
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  className="bg-red-700 hover:bg-red-800"
                  onClick={() => void handleRevokeAll()}
                  loading={busy}
                >
                  <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                  Revoke access for everyone
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setConfirmRevoke(true)}>
              <PhoneOff className="h-4 w-4" aria-hidden="true" />
              Revoke access for everyone
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}