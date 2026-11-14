/**
 * Formatting helpers for the admin dashboard.
 *
 * Kept separate from the components so the numbers on the dashboard are
 * produced by one implementation and can be tested without a browser. Times are
 * rendered in UTC and labelled as such: an operator looking at two different
 * machines must see the same instant, and a "14:02" with no zone is a guess.
 */

/** Thousands-separated integer, or an em dash for a missing/NaN value. */
export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return Math.trunc(value).toLocaleString('en-US')
}

/** `14 Nov 2026, 09:41 UTC`. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    hour12: false,
  }) + ' UTC'
}

/** `14 Nov` from either `2026-11-14` or a full ISO timestamp. */
export function formatDayLabel(value: string): string {
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  })
}

/** Bar height as a CSS percentage, clamped so a zero series never divides by zero. */
export function barWidth(value: number, max: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0%'
  const ceiling = Number.isFinite(max) && max > 0 ? max : value
  return `${Math.min(100, Math.round((value / ceiling) * 100))}%`
}

/** `33%`; an em dash when the whole is zero, because 0/0 is not 0%. */
export function formatPercent(part: number, whole: number): string {
  if (!whole || whole <= 0) return '—'
  return `${Math.round((part / whole) * 100)}%`
}

/** Initials for an avatar fallback. */
export function initials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((part) => part.charAt(0).toUpperCase()).join('') || '?'
}

/**
 * Expands a sparse day series into one point per day, oldest first, so a chart
 * shows a quiet day as a gap rather than stretching the one busy day across the
 * whole width. `now` is injectable so the output is testable.
 */
export function fillDailySeries(
  points: { date: string; count: number }[],
  days: number,
  now: Date = new Date()
): { date: string; count: number }[] {
  const byDate = new Map(points.map((point) => [point.date.slice(0, 10), point.count]))
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const series: { date: string; count: number }[] = []

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date(end - offset * 86_400_000).toISOString().slice(0, 10)
    series.push({ date: day, count: byDate.get(day) ?? 0 })
  }

  return series
}
