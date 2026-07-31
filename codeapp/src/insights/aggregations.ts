import type { AgentDetailRow } from '../data/types'

// ---------- shared helpers ----------

export interface NameValue {
  name: string
  value: number
}

/** Friendly label for blank/system values so charts show Names, never raw blanks. */
export function agentLabel(name: string | null, id: string | null): string {
  if (name && name.trim()) return name
  if (id && id.startsWith('T_')) return 'System / Teams agent'
  if (id === 'M365-Default') return 'M365 Copilot (default)'
  return 'Unnamed / deleted agent'
}

export function envLabel(name: string | null): string {
  return name && name.trim() ? name : 'Unknown / deleted environment'
}

function label(v: string | null, blank = '(none)'): string {
  return v && v.trim() ? v : blank
}

function round(n: number, dp = 2): number {
  const f = Math.pow(10, dp)
  return Math.round(n * f) / f
}

/** Group rows by a key function and sum a numeric selector; sorted desc. */
function groupSum(
  rows: AgentDetailRow[],
  keyFn: (r: AgentDetailRow) => string,
  valFn: (r: AgentDetailRow) => number
): NameValue[] {
  const map = new Map<string, number>()
  for (const r of rows) {
    const k = keyFn(r)
    map.set(k, (map.get(k) ?? 0) + valFn(r))
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value: round(value) }))
    .sort((a, b) => b.value - a.value)
}

export function topN<T>(items: T[], n: number): T[] {
  return items.slice(0, n)
}

const totalCredit = (r: AgentDetailRow) => r.billedCredit + r.nonBilledCredit

// ---------- 1. Cost & consumption ----------

export interface CostSummary {
  totalBilled: number
  totalNonBilled: number
  totalCredit: number
  rowCount: number
  agentCount: number
  environmentCount: number
  reportedUsers: number
}

export function costSummary(rows: AgentDetailRow[]): CostSummary {
  let b = 0
  let nb = 0
  let users = 0
  const agents = new Set<string>()
  const envs = new Set<string>()
  for (const r of rows) {
    b += r.billedCredit
    nb += r.nonBilledCredit
    users += r.users
    if (r.agentId) agents.add(r.agentId)
    if (r.environmentId) envs.add(r.environmentId)
  }
  return {
    totalBilled: round(b),
    totalNonBilled: round(nb),
    totalCredit: round(b + nb),
    rowCount: rows.length,
    agentCount: agents.size,
    environmentCount: envs.size,
    reportedUsers: users,
  }
}

export function billedVsNonBilled(rows: AgentDetailRow[]): NameValue[] {
  const s = costSummary(rows)
  return [
    { name: 'Billed', value: s.totalBilled },
    { name: 'Non-billed', value: s.totalNonBilled },
  ]
}

export interface ParetoPoint extends NameValue {
  cumulativePct: number
}

/** Top agents by total credit with cumulative % (Pareto / concentration). */
export function agentPareto(rows: AgentDetailRow[], n = 15): ParetoPoint[] {
  const items = groupSum(rows, (r) => agentLabel(r.agentName, r.agentId), totalCredit)
  const grandTotal = items.reduce((acc, i) => acc + i.value, 0) || 1
  let running = 0
  return topN(items, n).map((i) => {
    running += i.value
    return { ...i, cumulativePct: round((running / grandTotal) * 100, 1) }
  })
}

// ---------- 2. Ranking / leaderboards ----------

export interface Rankings {
  agents: NameValue[]
  environments: NameValue[]
  tools: NameValue[]
  features: NameValue[]
  models: NameValue[]
  channels: NameValue[]
}

export function rankings(rows: AgentDetailRow[], n = 10): Rankings {
  return {
    agents: topN(groupSum(rows, (r) => agentLabel(r.agentName, r.agentId), totalCredit), n),
    environments: topN(groupSum(rows, (r) => envLabel(r.environmentName), totalCredit), n),
    tools: topN(groupSum(rows.filter((r) => label(r.tool, '') !== ''), (r) => label(r.tool), totalCredit), n),
    features: topN(groupSum(rows, (r) => label(r.feature), totalCredit), n),
    models: topN(groupSum(rows.filter((r) => label(r.llmModel, '') !== ''), (r) => label(r.llmModel), totalCredit), n),
    channels: topN(groupSum(rows, (r) => label(r.channel), totalCredit), n),
  }
}

// ---------- 3. Distribution & segmentation ----------

export interface Distributions {
  byFeature: NameValue[]
  byChannel: NameValue[]
  modelMix: NameValue[]
  byKnowledgeSource: NameValue[]
}

export function distributions(rows: AgentDetailRow[]): Distributions {
  return {
    byFeature: groupSum(rows, (r) => label(r.feature), totalCredit),
    byChannel: groupSum(rows, (r) => label(r.channel), totalCredit),
    modelMix: groupSum(rows.filter((r) => label(r.llmModel, '') !== ''), (r) => label(r.llmModel), totalCredit),
    byKnowledgeSource: groupSum(
      rows.filter((r) => label(r.knowledgeSources, '') !== ''),
      (r) => label(r.knowledgeSources),
      totalCredit
    ),
  }
}

// ---------- 4. Adoption & engagement ----------

export interface CostPerUserPoint {
  name: string
  users: number
  billed: number
  costPerUser: number
}

export interface Adoption {
  usersByEnvironment: NameValue[]
  costPerUser: CostPerUserPoint[]
  activeVsDormant: NameValue[]
}

export function adoption(rows: AgentDetailRow[], n = 10): Adoption {
  const usersByEnv = groupSum(rows, (r) => envLabel(r.environmentName), (r) => r.users)

  // cost-per-user per environment (billed / reported users)
  const billedByEnv = new Map<string, number>()
  const usersMap = new Map<string, number>()
  for (const r of rows) {
    const k = envLabel(r.environmentName)
    billedByEnv.set(k, (billedByEnv.get(k) ?? 0) + r.billedCredit)
    usersMap.set(k, (usersMap.get(k) ?? 0) + r.users)
  }
  const costPerUser: CostPerUserPoint[] = [...billedByEnv.keys()]
    .map((k) => {
      const u = usersMap.get(k) ?? 0
      const b = billedByEnv.get(k) ?? 0
      return { name: k, users: u, billed: round(b), costPerUser: u > 0 ? round(b / u) : 0 }
    })
    .filter((p) => p.users > 0)
    .sort((a, b) => b.billed - a.billed)

  // active = env has any billed credit; dormant = only non-billed / zero
  let active = 0
  let dormant = 0
  const envBilled = new Map<string, number>()
  for (const r of rows) envBilled.set(envLabel(r.environmentName), (envBilled.get(envLabel(r.environmentName)) ?? 0) + r.billedCredit)
  for (const v of envBilled.values()) {
    if (v > 0) active++
    else dormant++
  }

  return {
    usersByEnvironment: topN(usersByEnv, n),
    costPerUser: topN(costPerUser, 40),
    activeVsDormant: [
      { name: 'Active (billed)', value: active },
      { name: 'Dormant (no billed)', value: dormant },
    ],
  }
}

// ---------- 5 & 6. Trend & forecast (daily series within the selected window) ----------

export interface DailyPoint {
  date: string
  billed: number
  nonBilled: number
  total: number
  cumulative: number
  rollingAvg?: number
}

export function dailySeries(rows: AgentDetailRow[]): DailyPoint[] {
  const map = new Map<string, { b: number; nb: number }>()
  for (const r of rows) {
    if (!r.reportDate) continue
    const cur = map.get(r.reportDate) ?? { b: 0, nb: 0 }
    cur.b += r.billedCredit
    cur.nb += r.nonBilledCredit
    map.set(r.reportDate, cur)
  }
  const series = [...map.entries()]
    .map(([date, v]) => ({ date, billed: round(v.b), nonBilled: round(v.nb), total: round(v.b + v.nb) }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // 7-day rolling average of total + running cumulative total
  const win = 7
  let run = 0
  return series.map((p, i) => {
    const start = Math.max(0, i - win + 1)
    const slice = series.slice(start, i + 1)
    const avg = slice.reduce((acc, s) => acc + s.total, 0) / slice.length
    run += p.total
    return { ...p, rollingAvg: round(avg), cumulative: round(run) }
  })
}

export interface WeekOverWeek {
  week: string
  total: number
  changePct: number | null
}

export function weekOverWeek(daily: DailyPoint[]): WeekOverWeek[] {
  // bucket by ISO-ish week (group every 7 days from the start)
  if (daily.length === 0) return []
  const weeks = new Map<string, number>()
  const first = new Date(daily[0].date + 'T00:00:00Z').getTime()
  for (const p of daily) {
    const days = Math.floor((new Date(p.date + 'T00:00:00Z').getTime() - first) / 86400000)
    const wk = `W${Math.floor(days / 7) + 1}`
    weeks.set(wk, (weeks.get(wk) ?? 0) + p.total)
  }
  const arr = [...weeks.entries()].map(([week, total]) => ({ week, total: round(total) }))
  return arr.map((w, i) => ({
    ...w,
    changePct: i === 0 ? null : round(((w.total - arr[i - 1].total) / (arr[i - 1].total || 1)) * 100, 1),
  }))
}

export interface Forecast {
  dailyAvg: number
  windowDays: number
  projectedWindowTotal: number
  observedTotal: number
  series: { date: string; total: number | null; forecast: number | null }[]
}

/**
 * Simple run-rate forecast: average daily total over the window projected
 * forward to fill the full window length. Stays within ONE window only.
 */
export function forecast(daily: DailyPoint[], windowDays: number): Forecast {
  const observed = daily.reduce((acc, p) => acc + p.total, 0)
  const dailyAvg = daily.length > 0 ? observed / daily.length : 0
  const projected = dailyAvg * windowDays

  const series: Forecast['series'] = daily.map((p) => ({ date: p.date, total: p.total, forecast: null }))
  // append forecast tail up to windowDays points
  if (daily.length > 0 && daily.length < windowDays) {
    const last = new Date(daily[daily.length - 1].date + 'T00:00:00Z')
    // connect the forecast line to the last actual point
    series[series.length - 1].forecast = daily[daily.length - 1].total
    for (let i = daily.length; i < windowDays; i++) {
      last.setUTCDate(last.getUTCDate() + 1)
      series.push({ date: last.toISOString().slice(0, 10), total: null, forecast: round(dailyAvg) })
    }
  }

  return {
    dailyAvg: round(dailyAvg),
    windowDays,
    projectedWindowTotal: round(projected),
    observedTotal: round(observed),
    series,
  }
}

// ---------- 7. Daily consumption broken down by a dimension (stacked series) ----------

export interface StackedDaily {
  /** One record per day: { date, <cat1>: n, <cat2>: n, …, Other: n } */
  data: Record<string, number | string>[]
  /** Ordered series keys (top categories + optional "Other"). */
  keys: string[]
}

/**
 * Build a daily stacked series of total credit (billed + non-billed) grouped by a
 * dimension (tool / feature / channel / model / knowledge source). Keeps the top-N
 * categories and rolls the rest into "Other".
 */
export function dailyByDimension(
  rows: AgentDetailRow[],
  keyFn: (r: AgentDetailRow) => string | null,
  opts: { topN?: number; dropBlank?: boolean } = {},
): StackedDaily {
  const { topN: n = 8, dropBlank = false } = opts

  const catTotal = new Map<string, number>()
  const points: { date: string; cat: string; v: number }[] = []
  for (const r of rows) {
    if (!r.reportDate) continue
    const raw = keyFn(r)
    const blank = !raw || !raw.trim()
    if (blank && dropBlank) continue
    const cat = blank ? '(none)' : raw!.trim()
    const v = totalCredit(r)
    catTotal.set(cat, (catTotal.get(cat) ?? 0) + v)
    points.push({ date: r.reportDate, cat, v })
  }

  const top = [...catTotal.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map((e) => e[0])
  const topSet = new Set(top)
  const keys = catTotal.size > top.length ? [...top, 'Other'] : [...top]

  const byDate = new Map<string, Record<string, number>>()
  for (const p of points) {
    const k = topSet.has(p.cat) ? p.cat : 'Other'
    let rec = byDate.get(p.date)
    if (!rec) {
      rec = {}
      byDate.set(p.date, rec)
    }
    rec[k] = (rec[k] ?? 0) + p.v
  }

  const data = [...byDate.keys()]
    .sort((a, b) => a.localeCompare(b))
    .map((date) => {
      const rec = byDate.get(date)!
      const row: Record<string, number | string> = { date }
      for (const k of keys) row[k] = round(rec[k] ?? 0)
      return row
    })

  return { data, keys }
}

// ---------- 8. Monthly aggregated credits ----------

export interface MonthlyPoint {
  month: string // YYYY-MM
  label: string // e.g. "Jul 2026"
  billed: number
  nonBilled: number
  total: number
}

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Total credit per calendar month, keeping the most recent `months` months. */
export function monthlySeries(rows: AgentDetailRow[], months = 6): MonthlyPoint[] {
  const map = new Map<string, { b: number; nb: number }>()
  for (const r of rows) {
    if (!r.reportDate) continue
    const ym = r.reportDate.slice(0, 7)
    const cur = map.get(ym) ?? { b: 0, nb: 0 }
    cur.b += r.billedCredit
    cur.nb += r.nonBilledCredit
    map.set(ym, cur)
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-months)
    .map(([ym, v]) => {
      const [y, m] = ym.split('-')
      return {
        month: ym,
        label: `${MONTH_ABBR[Number(m) - 1]} ${y}`,
        billed: round(v.b),
        nonBilled: round(v.nb),
        total: round(v.b + v.nb),
      }
    })
}
