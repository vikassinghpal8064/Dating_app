import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Activity,
  AlertTriangle,
  Ban,
  Heart,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react'
import { Button, InlineMessage, PageSpinner } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import {
  barWidth,
  fillDailySeries,
  formatCount,
  formatDateTime,
  formatDayLabel,
  formatPercent,
} from '../../utils/adminFormat'

interface SeriesPoint {
  date: string
  count: number
}

interface LabelCount {
  label: string
  count: number
}

interface AuditEntry {
  id: string
  action: string
  target_user_id: string | null
  details: Record<string, unknown> | null
  created_at: string
  admin_name: string | null
}

interface Overview {
  generated_at: string
  users: {
    total: number
    visible: number
    verified: number
    banned: number
    paused: number
    incognito: number
    admins: number
    new_today: number
    new_7d: number
    new_30d: number
    active_24h: number
    active_7d: number
    active_30d: number
  }
  engagement: {
    likes: number
    super_likes: number
    passes: number
    matches: number
    messages: number
    messages_24h: number
    messages_7d: number
    avg_messages_per_match: number
    matches_with_messages: number
  }
  moderation: {
    open_reports: number
    reviewing_reports: number
    reports_7d: number
    pending_photos: number
    pending_uploads: number
    pending_verifications: number
    pending_contact_requests: number
    blocked_pairs: number
    banned_emails: number
  }
  signups_30d: SeriesPoint[]
  messages_14d: SeriesPoint[]
  matches_14d: SeriesPoint[]
  gender_split: LabelCount[]
  age_buckets: LabelCount[]
  top_cities: LabelCount[]
  top_interests: LabelCount[]
  recent_audit: AuditEntry[]
}

function isOverview(value: unknown): value is Overview {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.users === 'object' &&
    typeof candidate.engagement === 'object' &&
    typeof candidate.moderation === 'object' &&
    Array.isArray(candidate.signups_30d)
  )
}

function StatTile({
  label,
  value,
  hint,
  icon,
  tone = 'default',
}: {
  label: string
  value: string
  hint?: string
  icon: ReactNode
  tone?: 'default' | 'danger' | 'warning' | 'success'
}) {
  const toneClasses = {
    default: 'text-primary-400',
    danger: 'text-red-400',
    warning: 'text-yellow-400',
    success: 'text-green-400',
  }

  return (
    <div className="rounded-2xl border border-dark-700 bg-dark-900/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-dark-400">{label}</p>
        <span className={toneClasses[tone]} aria-hidden="true">
          {icon}
        </span>
      </div>
      <p className={`mt-2 font-display text-3xl font-bold ${toneClasses[tone]}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-dark-500">{hint}</p>}
    </div>
  )
}

function BarSeries({ points, label }: { points: SeriesPoint[]; label: string }) {
  if (points.length === 0) {
    return <p className="text-sm text-dark-500">No activity in this window yet.</p>
  }

  const max = Math.max(...points.map((point) => point.count), 1)
  const total = points.reduce((sum, point) => sum + point.count, 0)

  return (
    <div>
      <div className="flex items-end gap-1" style={{ height: '140px' }} role="img" aria-label={`${label}: ${total} total`}>
        {points.map((point) => (
          <div key={point.date} className="flex h-full flex-1 flex-col justify-end">
            <div
              className="w-full rounded-t bg-gradient-to-t from-primary-600 to-primary-500"
              style={{ height: barWidth(point.count, max) }}
              title={`${formatDayLabel(point.date)}: ${point.count}`}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-dark-500">
        <span>{formatDayLabel(points[0].date)}</span>
        <span>{total} total</span>
        <span>{formatDayLabel(points[points.length - 1].date)}</span>
      </div>
    </div>
  )
}

function Distribution({ title, items, limit = 6 }: { title: string; items: LabelCount[]; limit?: number }) {
  const shown = items.slice(0, limit)
  const max = Math.max(...shown.map((item) => item.count), 1)

  return (
    <div>
      <h3 className="text-sm font-medium text-dark-200">{title}</h3>
      {shown.length === 0 ? (
        <p className="mt-2 text-sm text-dark-500">No data yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {shown.map((item) => (
            <li key={item.label}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-dark-300">{item.label}</span>
                <span className="tabular-nums text-dark-400">{formatCount(item.count)}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-dark-800">
                <div
                  className="h-full rounded-full bg-primary-500"
                  style={{ width: barWidth(item.count, max) }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function OverviewTab() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error: rpcError } = await supabase.rpc('admin_dashboard_overview')
    if (rpcError) {
      setError(rpcError.message)
      setOverview(null)
    } else if (!isOverview(data)) {
      setError('The analytics payload was not in the expected shape.')
      setOverview(null)
    } else {
      setOverview(data)
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading && !overview) {
    return <PageSpinner />
  }

  if (error) {
    return (
      <InlineMessage tone="error">
        Could not load analytics. {error}
      </InlineMessage>
    )
  }

  if (!overview) return null

  const { users, engagement, moderation } = overview
  const verifiedShare = formatPercent(users.verified, users.total)

  return (
    <section className="space-y-6" aria-labelledby="overview-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="overview-heading" className="font-display text-xl font-semibold text-dark-50">
            Product overview
          </h2>
          <p className="mt-1 text-sm text-dark-500">
            Generated {formatDateTime(overview.generated_at)}. All times are UTC.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} loading={loading}>
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Total members"
          value={formatCount(users.total)}
          hint={`${formatCount(users.visible)} visible · ${formatCount(users.new_7d)} joined this week`}
          icon={<Users className="h-5 w-5" />}
        />
        <StatTile
          label="Active in 7 days"
          value={formatCount(users.active_7d)}
          hint={`${formatCount(users.active_24h)} in the last 24 hours`}
          icon={<Activity className="h-5 w-5" />}
          tone="success"
        />
        <StatTile
          label="Matches"
          value={formatCount(engagement.matches)}
          hint={`${formatCount(engagement.likes)} likes · ${formatCount(engagement.passes)} passes`}
          icon={<Heart className="h-5 w-5" />}
        />
        <StatTile
          label="Messages"
          value={formatCount(engagement.messages)}
          hint={`${formatCount(engagement.messages_7d)} this week · ${engagement.avg_messages_per_match} per match`}
          icon={<MessageSquare className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Verified members"
          value={formatCount(users.verified)}
          hint={`${verifiedShare} of all members`}
          icon={<UserCheck className="h-5 w-5" />}
        />
        <StatTile
          label="Banned members"
          value={formatCount(users.banned)}
          hint={`${formatCount(users.paused)} paused · ${formatCount(users.incognito)} incognito`}
          icon={<Ban className="h-5 w-5" />}
          tone="danger"
        />
        <StatTile
          label="Open reports"
          value={formatCount(moderation.open_reports)}
          hint={`${formatCount(moderation.reviewing_reports)} in review · ${formatCount(moderation.reports_7d)} this week`}
          icon={<AlertTriangle className="h-5 w-5" />}
          tone="warning"
        />
        <StatTile
          label="Verification queue"
          value={formatCount(moderation.pending_verifications)}
          hint={`${formatCount(moderation.pending_photos + moderation.pending_uploads)} photos awaiting review`}
          icon={<ShieldCheck className="h-5 w-5" />}
          tone="warning"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-dark-700 bg-dark-900/60 p-5">
          <h3 className="font-display text-lg font-semibold text-dark-50">Signups, last 30 days</h3>
          <p className="mb-4 text-sm text-dark-500">
            {formatCount(users.new_30d)} new members · {formatCount(users.new_today)} today
          </p>
          <BarSeries points={fillDailySeries(overview.signups_30d, 30)} label="Signups, last 30 days" />
        </div>

        <div className="rounded-2xl border border-dark-700 bg-dark-900/60 p-5">
          <h3 className="font-display text-lg font-semibold text-dark-50">Messages, last 14 days</h3>
          <p className="mb-4 text-sm text-dark-500">
            {formatCount(engagement.messages_7d)} this week ·{' '}
            {formatCount(engagement.matches_with_messages)} conversations started
          </p>
          <BarSeries points={fillDailySeries(overview.messages_14d, 14)} label="Messages, last 14 days" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-dark-700 bg-dark-900/60 p-5">
          <Distribution title="Gender" items={overview.gender_split} />
        </div>
        <div className="rounded-2xl border border-dark-700 bg-dark-900/60 p-5">
          <Distribution title="Age groups" items={overview.age_buckets} />
        </div>
        <div className="rounded-2xl border border-dark-700 bg-dark-900/60 p-5">
          <Distribution title="Top cities" items={overview.top_cities} />
        </div>
        <div className="rounded-2xl border border-dark-700 bg-dark-900/60 p-5">
          <Distribution title="Interests" items={overview.top_interests} limit={8} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-dark-700 bg-dark-900/60 p-5">
          <h3 className="font-display text-lg font-semibold text-dark-50">Moderation queues</h3>
          <dl className="mt-4 space-y-3 text-sm">
            {[
              ['Open reports', moderation.open_reports],
              ['Reports in review', moderation.reviewing_reports],
              ['Pending profile photos', moderation.pending_photos],
              ['Pending uploads', moderation.pending_uploads],
              ['Pending verifications', moderation.pending_verifications],
              ['Pending contact requests', moderation.pending_contact_requests],
              ['Blocked pairs', moderation.blocked_pairs],
              ['Blocked email domains', moderation.banned_emails],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex items-center justify-between gap-3">
                <dt className="text-dark-400">{label}</dt>
                <dd className="tabular-nums font-medium text-dark-100">{formatCount(Number(value))}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="rounded-2xl border border-dark-700 bg-dark-900/60 p-5">
          <h3 className="font-display text-lg font-semibold text-dark-50">Recent admin activity</h3>
          {overview.recent_audit.length === 0 ? (
            <p className="mt-3 text-sm text-dark-500">No admin actions recorded yet.</p>
          ) : (
            <ul className="mt-4 space-y-3 text-sm">
              {overview.recent_audit.map((entry) => (
                <li key={entry.id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-dark-200">{entry.action.replaceAll('_', ' ')}</p>
                    <p className="text-xs text-dark-500">{entry.admin_name ?? 'Unknown admin'}</p>
                  </div>
                  <time className="shrink-0 text-xs text-dark-500" dateTime={entry.created_at}>
                    {formatDateTime(entry.created_at)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="New members, 30 days"
          value={formatCount(users.new_30d)}
          hint={`${formatCount(users.new_today)} today`}
          icon={<Users className="h-5 w-5" />}
        />
        <StatTile
          label="Messages, 24 hours"
          value={formatCount(engagement.messages_24h)}
          icon={<MessageSquare className="h-5 w-5" />}
        />
        <StatTile
          label="Conversations started"
          value={formatCount(engagement.matches_with_messages)}
          hint={`${formatCount(engagement.matches - engagement.matches_with_messages)} matches have no messages yet`}
          icon={<Heart className="h-5 w-5" />}
        />
      </div>
    </section>
  )
}

export default OverviewTab
