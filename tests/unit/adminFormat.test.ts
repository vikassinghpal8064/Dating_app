import { describe, expect, it } from 'vitest'
import {
  barWidth,
  fillDailySeries,
  formatCount,
  formatDateTime,
  formatDayLabel,
  formatPercent,
  initials,
} from '@/utils/adminFormat'

describe('formatCount', () => {
  it('separates thousands and truncates fractions', () => {
    expect(formatCount(1234567)).toBe('1,234,567')
    expect(formatCount(42.9)).toBe('42')
  })

  it('never prints NaN or undefined as a number', () => {
    expect(formatCount(null)).toBe('—')
    expect(formatCount(undefined)).toBe('—')
    expect(formatCount(Number.NaN)).toBe('—')
  })
})

describe('formatDateTime', () => {
  it('renders one stable instant in UTC regardless of the machine timezone', () => {
    expect(formatDateTime('2026-11-14T09:41:00Z')).toBe('14 Nov 2026, 09:41 UTC')
  })

  it('falls back to an em dash for missing or malformed values', () => {
    expect(formatDateTime(null)).toBe('—')
    expect(formatDateTime('not-a-date')).toBe('—')
  })
})

describe('formatDayLabel', () => {
  it('does not shift a date-only value across a timezone boundary', () => {
    expect(formatDayLabel('2026-11-01')).toBe('01 Nov')
  })

  it('accepts a full timestamp too', () => {
    expect(formatDayLabel('2026-11-01T23:30:00Z')).toBe('01 Nov')
  })
})

describe('barWidth', () => {
  it('scales against the maximum and clamps to 0-100%', () => {
    expect(barWidth(5, 10)).toBe('50%')
    expect(barWidth(10, 10)).toBe('100%')
    expect(barWidth(50, 10)).toBe('100%')
    expect(barWidth(-1, 10)).toBe('0%')
  })

  it('handles an all-zero series without dividing by zero', () => {
    expect(barWidth(0, 0)).toBe('0%')
    expect(barWidth(3, 0)).toBe('100%')
  })
})

describe('formatPercent', () => {
  it('rounds to whole percent', () => {
    expect(formatPercent(1, 3)).toBe('33%')
    expect(formatPercent(2, 2)).toBe('100%')
  })

  it('returns an em dash when the denominator is zero', () => {
    expect(formatPercent(0, 0)).toBe('—')
  })
})

describe('initials', () => {
  it('takes the first letter of the first two words', () => {
    expect(initials('Riya Kapoor')).toBe('RK')
    expect(initials('demo')).toBe('D')
  })

  it('survives an empty or missing name', () => {
    expect(initials('')).toBe('?')
    expect(initials(null)).toBe('?')
  })
})

describe('fillDailySeries', () => {
  const now = new Date('2026-11-14T10:00:00Z')

  it('returns one point per day, oldest first, filling quiet days with zero', () => {
    const series = fillDailySeries([{ date: '2026-11-12', count: 3 }], 3, now)
    expect(series).toEqual([
      { date: '2026-11-12', count: 3 },
      { date: '2026-11-13', count: 0 },
      { date: '2026-11-14', count: 0 },
    ])
  })

  it('ignores points outside the window and keeps the series length exact', () => {
    const series = fillDailySeries(
      [
        { date: '2026-10-01', count: 99 },
        { date: '2026-11-14', count: 2 },
      ],
      7,
      now
    )
    expect(series).toHaveLength(7)
    expect(series.at(-1)).toEqual({ date: '2026-11-14', count: 2 })
    expect(series.reduce((sum, point) => sum + point.count, 0)).toBe(2)
  })
})
