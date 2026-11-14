import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Database, LogOut, Shield, SlidersHorizontal, User, Ban } from 'lucide-react'
import {
  Button,
  InlineMessage,
  Input,
  PageContainer,
  PageHeader,
  QueryState,
  Select,
  Toggle,
} from '../../components/ui'
import { useAuth } from '../../lib/authContext'
import { usePreferences } from '../../hooks/usePreferences'
import { preferencesSchema } from '../../utils/validation'
import { DISTANCE_BUCKETS, distanceBucket } from '../../utils'
import { ContactSettings } from '../../components/contact/ContactSettings'
import { RequestsList } from '../../components/contact/RequestsList'
import type { UserPreferences } from '../../types'

const SHOW_ME_OPTIONS = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'interested_in_me', label: 'Only people who fit my preferences' },
  { value: 'matches_only', label: 'Only my matches' },
]

const NOTIFICATION_FIELDS: { key: keyof UserPreferences['notifications']; label: string }[] = [
  { key: 'new_match', label: 'New match' },
  { key: 'new_message', label: 'New message' },
  { key: 'whatsapp_request', label: 'WhatsApp number request' },
  { key: 'profile_liked', label: 'Someone liked me' },
]

const PRIVACY_FIELDS: { key: keyof UserPreferences['privacy']; label: string; hint: string }[] = [
  {
    key: 'show_distance',
    label: 'Show my distance band',
    hint: 'Others see a band such as “10 to 25 km away”, never a precise distance.',
  },
  {
    key: 'show_online_status',
    label: 'Show when I am online',
    hint: 'Turn this off and nobody sees the online dot on your profile.',
  },
  {
    key: 'show_last_active',
    label: 'Show when I was last active',
    hint: 'Displayed as a relative time such as “2 hours ago”, never an exact timestamp.',
  },
]

export function SettingsPage() {
  const { user, signOut } = useAuth()
  const { data, status, error, reload, save, saving, saveError, savedAt } = usePreferences()

  const [draft, setDraft] = useState<UserPreferences | null>(null)
  const [validationError, setValidationError] = useState('')

  useEffect(() => {
    if (data && draft === null) setDraft(data)
  }, [data, draft])

  const maxDistanceOptions = DISTANCE_BUCKETS.map((bucket) => ({
    value: String(bucket.maxKm === Infinity ? 500 : bucket.maxKm),
    label: bucket.label,
  }))

  async function handleSave(event: FormEvent) {
    event.preventDefault()
    if (!draft) return

    const parsed = preferencesSchema.safeParse({
      minAge: draft.min_age,
      maxAge: draft.max_age,
      maxDistanceKm: draft.max_distance_km,
      showMeTo: draft.show_me_to,
      notifications: {
        newMatch: draft.notifications.new_match,
        newMessage: draft.notifications.new_message,
        whatsappRequest: draft.notifications.whatsapp_request,
        profileLiked: draft.notifications.profile_liked,
      },
      privacy: {
        showDistance: draft.privacy.show_distance,
        showOnlineStatus: draft.privacy.show_online_status,
        showLastActive: draft.privacy.show_last_active,
      },
    })

    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message ?? 'Check the values you entered.')
      return
    }

    setValidationError('')
    await save(draft)
  }

  return (
    <PageContainer variant="narrow">
      <PageHeader title="Settings" subtitle="Your account, privacy and discovery preferences." />

      <QueryState status={status} error={error} onRetry={reload} label="your settings">
        {draft && (
          <>
          <form onSubmit={handleSave} className="space-y-6" noValidate>
            {validationError && <InlineMessage tone="error">{validationError}</InlineMessage>}
            {saveError && <InlineMessage tone="error">{saveError}</InlineMessage>}
            {savedAt && !saveError && (
              <InlineMessage tone="success">Your preferences have been saved.</InlineMessage>
            )}

            <section className="glass rounded-2xl p-5">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-dark-50">
                <User className="h-5 w-5 text-primary-400" aria-hidden="true" />
                Account
              </h2>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-sm text-dark-400">Name</dt>
                  <dd className="text-dark-100">{user?.full_name}</dd>
                </div>
                <div>
                  <dt className="text-sm text-dark-400">Email</dt>
                  <dd className="break-all text-dark-100">{user?.email}</dd>
                </div>
                <div>
                  <dt className="text-sm text-dark-400">Email status</dt>
                  <dd className="text-dark-100">
                    {user?.age_verified ? 'Verified' : 'Not verified'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-dark-400">Password</dt>
                  <dd className="text-dark-100">
                    <Link
                      to="/auth/forgot-password"
                      className="text-primary-400 underline underline-offset-2"
                    >
                      Send me a reset link
                    </Link>
                  </dd>
                </div>
              </dl>
            </section>

            <section className="glass rounded-2xl p-5">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-dark-50">
                <SlidersHorizontal className="h-5 w-5 text-primary-400" aria-hidden="true" />
                Discovery
              </h2>

              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <Input
                  label="Minimum age"
                  type="number"
                  min={18}
                  max={99}
                  value={draft.min_age}
                  onChange={(e) =>
                    setDraft({ ...draft, min_age: Number(e.target.value) || 18 })
                  }
                />
                <Input
                  label="Maximum age"
                  type="number"
                  min={18}
                  max={99}
                  value={draft.max_age}
                  onChange={(e) =>
                    setDraft({ ...draft, max_age: Number(e.target.value) || 18 })
                  }
                />
                <Select
                  label="Maximum distance"
                  options={maxDistanceOptions}
                  value={String(draft.max_distance_km)}
                  onChange={(e) =>
                    setDraft({ ...draft, max_distance_km: Number(e.target.value) })
                  }
                />
              </div>

              <p className="mt-3 text-xs text-dark-500">
                {distanceBucket(draft.max_distance_km)?.label} is the widest band you will be shown.
              </p>

              <div className="mt-4">
                <Select
                  label="Who can discover me"
                  options={SHOW_ME_OPTIONS}
                  value={draft.show_me_to}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      show_me_to: e.target.value as UserPreferences['show_me_to'],
                    })
                  }
                />
              </div>
            </section>

            <section className="glass rounded-2xl p-5">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-dark-50">
                <Bell className="h-5 w-5 text-primary-400" aria-hidden="true" />
                Notifications
              </h2>
              <div className="mt-4 space-y-4">
                {NOTIFICATION_FIELDS.map((field) => (
                  <Toggle
                    key={field.key}
                    label={field.label}
                    checked={draft.notifications[field.key]}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        notifications: {
                          ...draft.notifications,
                          [field.key]: e.target.checked,
                        },
                      })
                    }
                  />
                ))}
              </div>
            </section>

            <section className="glass rounded-2xl p-5">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-dark-50">
                <Shield className="h-5 w-5 text-primary-400" aria-hidden="true" />
                Privacy
              </h2>
              <div className="mt-4 space-y-4">
                {PRIVACY_FIELDS.map((field) => (
                  <Toggle
                    key={field.key}
                    label={field.label}
                    description={field.hint}
                    checked={draft.privacy[field.key]}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        privacy: { ...draft.privacy, [field.key]: e.target.checked },
                      })
                    }
                  />
                ))}
              </div>

              <div className="mt-5 flex items-start gap-3 rounded-xl border border-dark-700 bg-dark-900/60 p-3 text-sm text-dark-300">
                <Database className="mt-0.5 h-4 w-4 shrink-0 text-primary-400" aria-hidden="true" />
                <p className="leading-relaxed">
                  To export or delete your data, email{' '}
                  <a
                    href="mailto:privacy@heartconnect.app"
                    className="text-primary-400 underline underline-offset-2"
                  >
                    privacy@heartconnect.app
                  </a>
                  . We action access and deletion requests within 30 days.
                </p>
              </div>
            </section>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" onClick={() => setDraft(data)}>
                Discard changes
              </Button>
              <Button type="submit" loading={saving}>
                {saving ? 'Saving…' : 'Save preferences'}
              </Button>
            </div>

            <div className="border-t border-dark-800 pt-6">
              <Button variant="outline" onClick={() => void signOut()} className="w-full sm:w-auto">
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Sign out
              </Button>
            </div>
          </form>

          {/* WhatsApp contact lives outside the preferences form above: it has
              its own data surface and its own save button, and none of it
              belongs in the preferences rows. */}
          <div className="mt-6 space-y-6">
            <ContactSettings />
            <RequestsList />

            {/* Blocked users link */}
            <section className="glass rounded-2xl p-5">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-dark-50">
                <Ban className="h-5 w-5 text-danger-400" aria-hidden="true" />
                Blocked users
              </h2>
              <p className="mt-2 text-sm text-dark-400">
                Manage users you&apos;ve blocked. Blocked users can&apos;t see your profile or message you.
              </p>
              <Link
                to="/app/settings/blocked"
                className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary-400 underline underline-offset-2 hover:text-primary-300"
              >
                View blocked users
                <span aria-hidden="true">→</span>
              </Link>
            </section>
          </div>
          </>
        )}
      </QueryState>
    </PageContainer>
  )
}
