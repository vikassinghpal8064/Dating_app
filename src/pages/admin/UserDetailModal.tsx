import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Ban, Phone, ShieldCheck, UserCheck } from 'lucide-react'
import {
  Badge,
  Button,
  InlineMessage,
  Modal,
  PageSpinner,
  Textarea,
} from '../../components/ui'
import { supabase } from '../../lib/supabase'
import { formatCount, formatDateTime, initials } from '../../utils/adminFormat'

interface DetailProfile {
  id: string
  email: string | null
  full_name: string | null
  date_of_birth: string | null
  age: number
  gender: string
  interested_in: string[]
  bio: string
  photos: string[]
  location_city: string | null
  location_state: string | null
  location_country: string | null
  latitude: number | null
  longitude: number | null
  height_cm: number | null
  education: string | null
  occupation: string | null
  looking_for: string
  interests: string[]
  languages: string[]
  smoking: string
  drinking: string
  exercise: string
  show_distance: boolean
  age_verified: boolean
  phone_verified: boolean
  whatsapp_consent: boolean
  is_verified: boolean
  is_visible: boolean
  is_banned: boolean
  is_admin: boolean
  incognito: boolean
  profile_paused: boolean
  created_at: string
  updated_at: string
  last_active_at: string
  roles: string[]
  email_confirmed_at: string | null
  last_sign_in_at: string | null
  has_phone_number: boolean
  preferences: {
    min_age: number
    max_age: number
    max_distance_km: number
    show_me_to: string
    notifications: Record<string, boolean> | null
    privacy: Record<string, boolean> | null
  } | null
}

interface DetailStats {
  photos: number
  approved_uploads: number
  pending_uploads: number
  likes_sent: number
  likes_received: number
  passes_sent: number
  matches: number
  messages_sent: number
  messages_received: number
  reports_made: number
  reports_against: number
  blocks_made: number
  blocked_by: number
  contact_requests_sent: number
  contact_requests_received: number
}

interface MatchRow {
  match_id: string
  matched_at: string
  last_message_at: string | null
  other_id: string | null
  other_name: string | null
  message_count: number
}

interface MessageRow {
  id: string
  match_id: string
  sender_id: string
  sender_name: string
  content: string
  message_type: string
  read_at: string | null
  created_at: string
}

interface ReportRow {
  id: string
  reason: string
  details: string | null
  status: string
  created_at: string
  reporter_name: string | null
}

interface VerificationRow {
  id: string
  status: string
  pose_prompt: string
  reason: string | null
  created_at: string
  reviewed_at: string | null
}

interface AuditRow {
  id: string
  action: string
  details: Record<string, unknown> | null
  created_at: string
  admin_name: string | null
}

interface ContactInfo {
  user_id: string
  whatsapp_number: string | null
  share_mode?: string
  whatsapp_consent?: boolean
  phone_verified?: boolean
  updated_at?: string
}

interface UserDetail {
  profile: DetailProfile
  stats: DetailStats
  matches: MatchRow[]
  recent_messages: MessageRow[]
  reports_against: ReportRow[]
  verification_requests: VerificationRow[]
  audit_log: AuditRow[]
}

function isUserDetail(value: unknown): value is UserDetail {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return typeof candidate.profile === 'object' && typeof candidate.stats === 'object'
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-dark-500">{label}</dt>
      <dd className="mt-1 text-sm text-dark-200">{value ?? '—'}</dd>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-dark-700 bg-dark-900/60 p-4">
      <h3 className="font-display text-base font-semibold text-dark-50">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-dark-800 bg-dark-950/40 px-3 py-2">
      <p className="text-xs text-dark-500">{label}</p>
      <p className="mt-1 font-display text-lg font-semibold text-dark-100">{formatCount(value)}</p>
    </div>
  )
}

export function UserDetailModal({
  userId,
  onClose,
  onChanged,
}: {
  userId: string
  onClose: () => void
  onChanged?: () => void
}) {
  const [detail, setDetail] = useState<UserDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [action, setAction] = useState<'ban' | 'unban' | null>(null)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [contact, setContact] = useState<ContactInfo | null>(null)
  const [contactLoading, setContactLoading] = useState(false)
  const [contactError, setContactError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error: rpcError } = await supabase.rpc('admin_get_user', { p_user: userId })
    if (rpcError) {
      setError(rpcError.message)
      setDetail(null)
    } else if (!isUserDetail(data)) {
      setError('The member payload was not in the expected shape.')
      setDetail(null)
    } else {
      setDetail(data)
      setError(null)
    }
    setLoading(false)
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  const revealContact = async () => {
    setContactLoading(true)
    setContactError(null)
    try {
      const { data, error: rpcError } = await supabase.rpc('admin_reveal_contact', {
        p_user: userId,
      })
      if (rpcError) {
        setContactError(rpcError.message)
        return
      }
      const value = data as unknown as ContactInfo | null
      if (!value || typeof value !== 'object') {
        setContactError('The contact payload was not in the expected shape.')
        return
      }
      setContact(value)
    } finally {
      setContactLoading(false)
    }
  }

  const runAction = async () => {
    if (!detail || !action) return
    setSubmitting(true)
    setActionError(null)
    try {
      const { error: rpcError } =
        action === 'ban'
          ? await supabase.rpc('admin_ban_user', {
              p_user: detail.profile.id,
              p_reason: reason.trim() || 'Violation of community guidelines',
            })
          : await supabase.rpc('admin_unban_user', { p_user: detail.profile.id })

      if (rpcError) {
        setActionError(rpcError.message)
        return
      }

      setAction(null)
      setReason('')
      await load()
      onChanged?.()
    } finally {
      setSubmitting(false)
    }
  }

  const profile = detail?.profile

  return (
    <Modal isOpen onClose={onClose} title="Member detail" size="xl">
      {loading && !detail ? (
        <PageSpinner />
      ) : error ? (
        <InlineMessage tone="error">{error}</InlineMessage>
      ) : detail && profile ? (
        <div className="max-h-[75vh] space-y-4 overflow-y-auto pr-1">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <span
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary-600/20 font-display text-lg font-semibold text-primary-300"
                aria-hidden="true"
              >
                {initials(profile.full_name)}
              </span>
              <div className="min-w-0">
                <p className="font-display text-xl font-semibold text-dark-50">
                  {profile.full_name ?? 'Unnamed member'}
                </p>
                <p className="truncate text-sm text-dark-400">{profile.email ?? 'No email'}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {profile.is_admin && <Badge variant="premium">Admin</Badge>}
                  {profile.is_verified && <Badge variant="verified">Verified</Badge>}
                  {profile.is_banned && (
                    <Badge className="border-red-500/30 bg-red-500/20 text-red-300">Banned</Badge>
                  )}
                  {profile.incognito && <Badge variant="warning">Incognito</Badge>}
                  {profile.profile_paused && <Badge variant="warning">Paused</Badge>}
                  {!profile.is_visible && <Badge>Hidden from discovery</Badge>}
                </div>
              </div>
            </div>
            <div className="shrink-0 text-right text-xs text-dark-500">
              <p>Joined {formatDateTime(profile.created_at)}</p>
              <p>Last active {formatDateTime(profile.last_active_at)}</p>
              <p>Last sign-in {formatDateTime(profile.last_sign_in_at)}</p>
            </div>
          </div>

          <InlineMessage tone="info">
            Reading this panel is written to the audit log. The WhatsApp number is shown only
            when you reveal it, and that reveal is written to the audit log as well.
          </InlineMessage>

          <Section title="Activity">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Likes sent" value={detail.stats.likes_sent} />
              <Stat label="Likes received" value={detail.stats.likes_received} />
              <Stat label="Passes" value={detail.stats.passes_sent} />
              <Stat label="Matches" value={detail.stats.matches} />
              <Stat label="Messages sent" value={detail.stats.messages_sent} />
              <Stat label="Messages received" value={detail.stats.messages_received} />
              <Stat label="Reports against" value={detail.stats.reports_against} />
              <Stat label="Reports made" value={detail.stats.reports_made} />
              <Stat label="Photos" value={detail.stats.photos} />
              <Stat label="Approved uploads" value={detail.stats.approved_uploads} />
              <Stat label="Pending uploads" value={detail.stats.pending_uploads} />
              <Stat label="Contact requests sent" value={detail.stats.contact_requests_sent} />
            </div>
          </Section>

          <Section title="Profile">
            <dl className="grid gap-3 sm:grid-cols-3">
              <Field label="Age" value={`${profile.age}`} />
              <Field label="Date of birth" value={profile.date_of_birth} />
              <Field label="Gender" value={profile.gender.replaceAll('_', ' ')} />
              <Field label="Interested in" value={profile.interested_in.join(', ')} />
              <Field label="Looking for" value={profile.looking_for} />
              <Field label="Height" value={profile.height_cm ? `${profile.height_cm} cm` : null} />
              <Field label="Education" value={profile.education} />
              <Field label="Occupation" value={profile.occupation} />
              <Field
                label="Location"
                value={[profile.location_city, profile.location_state, profile.location_country]
                  .filter(Boolean)
                  .join(', ') || null}
              />
              <Field
                label="Stored coordinates"
                value={
                  profile.latitude !== null && profile.longitude !== null ? (
                    <span>
                      {profile.latitude}, {profile.longitude}{' '}
                      <a
                        href={`https://www.openstreetmap.org/?mlat=${profile.latitude}&mlon=${profile.longitude}#map=13/${profile.latitude}/${profile.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-400 underline underline-offset-2 hover:text-primary-300"
                      >
                        open map
                      </a>
                      <span className="block text-xs text-dark-500">
                        Stored at 2 decimals (~1 km). Exact GPS is never written.
                      </span>
                    </span>
                  ) : null
                }
              />
              <Field
                label="WhatsApp number"
                value={
                  !profile.has_phone_number ? (
                    'None on file'
                  ) : contact ? (
                    <span className="space-y-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-dark-50">
                          {contact.whatsapp_number ?? 'No number on file'}
                        </span>
                        {contact.whatsapp_number && (
                          <button
                            type="button"
                            onClick={() => {
                              void navigator.clipboard?.writeText(contact.whatsapp_number ?? '')
                            }}
                            className="rounded bg-dark-800 px-2 py-0.5 text-xs text-dark-300 hover:bg-dark-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
                          >
                            Copy
                          </button>
                        )}
                      </span>
                      <span className="block text-xs text-dark-500">
                        Sharing: {contact.share_mode ?? 'unknown'} · consent:{' '}
                        {contact.whatsapp_consent ? 'yes' : 'no'}
                      </span>
                    </span>
                  ) : (
                    <span className="space-y-1">
                      <button
                        type="button"
                        onClick={() => void revealContact()}
                        disabled={contactLoading}
                        className="inline-flex items-center gap-1 rounded-lg border border-dark-700 px-2.5 py-1 text-xs font-medium text-dark-200 transition-colors hover:border-dark-600 hover:text-dark-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 disabled:opacity-50"
                      >
                        <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                        {contactLoading ? 'Revealing…' : 'Reveal number'}
                      </button>
                      <span className="block text-xs text-dark-500">Access is logged.</span>
                    </span>
                  )
                }
              />
              <Field label="WhatsApp consent" value={profile.whatsapp_consent ? 'Yes' : 'No'} />
              <Field label="Phone verified" value={profile.phone_verified ? 'Yes' : 'No'} />
              <Field label="Age verified" value={profile.age_verified ? 'Yes' : 'No'} />
              <Field label="Member id" value={<span className="break-all font-mono text-xs">{profile.id}</span>} />
            </dl>
            {contactError && (
              <div className="mt-3">
                <InlineMessage tone="error">{contactError}</InlineMessage>
              </div>
            )}
            <div className="mt-4 space-y-3">
              <Field label="Bio" value={profile.bio || null} />
              <Field label="Interests" value={profile.interests.join(', ') || null} />
              <Field label="Languages" value={profile.languages.join(', ') || null} />
              <Field
                label="Lifestyle"
                value={`Smoking: ${profile.smoking} · Drinking: ${profile.drinking} · Exercise: ${profile.exercise}`}
              />
            </div>
          </Section>

          <Section title="Preferences and privacy">
            {profile.preferences ? (
              <dl className="grid gap-3 sm:grid-cols-3">
                <Field
                  label="Age range"
                  value={`${profile.preferences.min_age}–${profile.preferences.max_age}`}
                />
                <Field label="Max distance" value={`${profile.preferences.max_distance_km} km`} />
                <Field label="Show me to" value={profile.preferences.show_me_to} />
                <Field label="Show distance" value={profile.show_distance ? 'Yes' : 'No'} />
                <Field label="Incognito" value={profile.incognito ? 'On' : 'Off'} />
                <Field label="Paused" value={profile.profile_paused ? 'On' : 'Off'} />
                <Field
                  label="Notifications"
                  value={
                    profile.preferences.notifications
                      ? Object.entries(profile.preferences.notifications)
                          .map(([key, on]) => `${key}: ${on ? 'on' : 'off'}`)
                          .join(' · ')
                      : null
                  }
                />
                <Field
                  label="Privacy"
                  value={
                    profile.preferences.privacy
                      ? Object.entries(profile.preferences.privacy)
                          .map(([key, on]) => `${key}: ${on ? 'on' : 'off'}`)
                          .join(' · ')
                      : null
                  }
                />
                <Field label="Roles" value={profile.roles.join(', ') || 'None'} />
              </dl>
            ) : (
              <p className="text-sm text-dark-500">No preferences row.</p>
            )}
          </Section>

          <Section title={`Matches (${detail.matches.length})`}>
            {detail.matches.length === 0 ? (
              <p className="text-sm text-dark-500">No matches.</p>
            ) : (
              <ul className="divide-y divide-dark-800">
                {detail.matches.map((match) => (
                  <li key={match.match_id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="text-dark-200">{match.other_name ?? 'Deleted member'}</span>
                    <span className="text-xs text-dark-500">
                      {match.message_count} messages · {formatDateTime(match.matched_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title={`Recent messages (${detail.recent_messages.length})`}>
            {detail.recent_messages.length === 0 ? (
              <p className="text-sm text-dark-500">No messages.</p>
            ) : (
              <ul className="space-y-2">
                {detail.recent_messages.map((message) => (
                  <li key={message.id} className="rounded-xl border border-dark-800 bg-dark-950/40 p-3">
                    <div className="flex items-center justify-between gap-2 text-xs text-dark-500">
                      <span className="font-medium text-dark-300">{message.sender_name}</span>
                      <span>{formatDateTime(message.created_at)}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-dark-200">
                      {message.content}
                    </p>
                    <p className="mt-1 text-xs text-dark-500">
                      {message.message_type} · {message.read_at ? 'read' : 'unread'}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {detail.reports_against.length > 0 && (
            <Section title={`Reports against this member (${detail.reports_against.length})`}>
              <ul className="space-y-2">
                {detail.reports_against.map((report) => (
                  <li key={report.id} className="rounded-xl border border-dark-800 bg-dark-950/40 p-3 text-sm">
                    <p className="font-medium text-dark-200">{report.reason}</p>
                    {report.details && <p className="mt-1 text-dark-300">{report.details}</p>}
                    <p className="mt-1 text-xs text-dark-500">
                      {report.reporter_name ?? 'Unknown reporter'} · {report.status} ·{' '}
                      {formatDateTime(report.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {detail.verification_requests.length > 0 && (
            <Section title="Verification requests">
              <ul className="space-y-2 text-sm">
                {detail.verification_requests.map((request) => (
                  <li key={request.id} className="flex items-center justify-between gap-3">
                    <span className="text-dark-300">{request.pose_prompt}</span>
                    <span className="text-xs text-dark-500">
                      {request.status} · {formatDateTime(request.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title="Audit trail">
            {detail.audit_log.length === 0 ? (
              <p className="text-sm text-dark-500">No admin actions recorded against this member.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {detail.audit_log.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-3">
                    <span className="text-dark-300">{entry.action.replaceAll('_', ' ')}</span>
                    <span className="text-xs text-dark-500">
                      {entry.admin_name ?? 'Unknown admin'} · {formatDateTime(entry.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Account controls">
            {action ? (
              <div className="space-y-3">
                {action === 'ban' && (
                  <Textarea
                    label="Reason (recorded in the audit log)"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Explain the ban..."
                  />
                )}
                {actionError && <InlineMessage tone="error">{actionError}</InlineMessage>}
                <div className="flex gap-2">
                  <Button onClick={runAction} loading={submitting}>
                    Confirm {action}
                  </Button>
                  <Button variant="outline" onClick={() => setAction(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {profile.is_banned ? (
                  <Button onClick={() => setAction('unban')}>
                    <UserCheck className="mr-2 h-4 w-4" aria-hidden="true" />
                    Unban member
                  </Button>
                ) : (
                  <button
                    onClick={() => setAction('ban')}
                    className="inline-flex items-center rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
                  >
                    <Ban className="mr-2 h-4 w-4" aria-hidden="true" />
                    Ban member
                  </button>
                )}
                <Button variant="outline" onClick={load} disabled={loading}>
                  <ShieldCheck className="mr-2 h-4 w-4" aria-hidden="true" />
                  Reload
                </Button>
              </div>
            )}
          </Section>
        </div>
      ) : null}
    </Modal>
  )
}

export default UserDetailModal
