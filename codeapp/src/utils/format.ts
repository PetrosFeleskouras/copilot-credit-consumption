// Formatting + chart palette shared across components.

export function formatCredits(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

export function formatInt(n: number): string {
  return n.toLocaleString()
}

export function truncate(s: string, max = 28): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

// Categorical palette aligned to Power Platform admin center (teal, purple, magenta …).
export const PALETTE = [
  '#1E8A76',
  '#8661C5',
  '#C4314B',
  '#0F6CBD',
  '#C19C00',
  '#008272',
  '#D83B01',
  '#5C2E91',
  '#498205',
  '#CA5010',
  '#004E8C',
  '#986F0B',
]

export function colorAt(i: number): string {
  return PALETTE[i % PALETTE.length]
}
