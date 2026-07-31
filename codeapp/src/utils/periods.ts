import type { DateRange, PeriodKey, PeriodOption } from '../data/types'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const iso = (d: Date) => d.toISOString().split('T')[0]

/**
 * Build the standard set of named time-period options relative to `today` (UTC).
 * The single-month labels (e.g. "June 2026") are computed dynamically.
 */
export function buildPeriodOptions(today: Date = new Date()): PeriodOption[] {
  const y = today.getUTCFullYear()
  const m = today.getUTCMonth()
  const todayStr = iso(today)
  const monthLabel = (d: Date) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`

  const curMonthStart = new Date(Date.UTC(y, m, 1))
  const prevMonthStart = new Date(Date.UTC(y, m - 1, 1))
  const prevMonthEnd = new Date(Date.UTC(y, m, 0)) // day 0 of current month = last day of prev month
  const prev2MonthStart = new Date(Date.UTC(y, m - 2, 1))
  const prev2MonthEnd = new Date(Date.UTC(y, m - 1, 0))

  return [
    { key: 'mtd', label: 'Month to date', range: { from: iso(curMonthStart), to: todayStr } },
    { key: 'prevMonth', label: monthLabel(prevMonthStart), range: { from: iso(prevMonthStart), to: iso(prevMonthEnd) } },
    { key: 'prevMonth2', label: monthLabel(prev2MonthStart), range: { from: iso(prev2MonthStart), to: iso(prev2MonthEnd) } },
    { key: 'last3m', label: 'Last 3 months', range: { from: iso(prev2MonthStart), to: todayStr } },
  ]
}

/** Default custom range = current month to date. */
export function defaultCustomRange(today: Date = new Date()): DateRange {
  return buildPeriodOptions(today)[0].range
}

/** Resolve the effective inclusive date range for the selected period key. */
export function resolveRange(key: PeriodKey, options: PeriodOption[], custom: DateRange): DateRange {
  if (key === 'custom') return custom
  return options.find((o) => o.key === key)?.range ?? custom
}
