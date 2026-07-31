import { useState } from 'react'
import type { ReactNode } from 'react'
import { tokens } from '@fluentui/react-components'

interface Item {
  name: string
  value: number
  color: string
}
interface Pinned {
  x: number
  y: number
  label: string
  items: Item[]
}
interface ClickState {
  activeCoordinate?: { x: number; y: number }
  activeLabel?: unknown
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  activePayload?: any[]
}

interface Props {
  formatter?: (name: string, value: number) => string
  children: (onChartClick: (state: unknown) => void) => ReactNode
}

/**
 * Wraps a recharts chart: hover shows the chart's own tooltip; clicking pins a custom,
 * selectable tooltip and blocks further hover; clicking again or leaving closes it.
 */
export function Pinnable({ formatter = (_, v) => String(v), children }: Props) {
  const [pinned, setPinned] = useState<Pinned | null>(null)

  const onChartClick = (state: unknown) => {
    const s = state as ClickState | undefined
    if (!s?.activeCoordinate || !s.activePayload?.length) return
    setPinned((prev) =>
      prev
        ? null
        : {
            x: s.activeCoordinate!.x,
            y: s.activeCoordinate!.y,
            label: s.activeLabel != null ? String(s.activeLabel) : '',
            items: s.activePayload!.map((p) => ({
              name: String(p.name ?? p.dataKey ?? ''),
              value: Number(p.value),
              color: (p.color as string) || (p.fill as string) || (p.stroke as string) || '#666',
            })),
          },
    )
  }

  return (
    <div
      style={{ position: 'relative', width: '100%', height: '100%' }}
      onMouseLeave={() => setPinned(null)}
    >
      {children(onChartClick)}
      {pinned && (
        <>
          {/* Transparent layer captures the mouse so the chart underneath stops reacting to hover. */}
          <div style={{ position: 'absolute', inset: 0, zIndex: 5 }} onClick={() => setPinned(null)} />
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              left: pinned.x,
              top: pinned.y,
              transform: 'translate(8px, 8px)',
              zIndex: 6,
              pointerEvents: 'auto',
              userSelect: 'text',
              maxWidth: 320,
              whiteSpace: 'normal',
              wordBreak: 'break-word',
              background: tokens.colorNeutralBackground1,
              border: `1px solid ${tokens.colorNeutralStroke2}`,
              borderRadius: '4px',
              padding: '6px 8px',
              boxShadow: tokens.shadow8,
              fontSize: '12px',
              lineHeight: 1.4,
            }}
          >
            {pinned.label && <div style={{ fontWeight: 600, marginBottom: 2 }}>{pinned.label}</div>}
            {pinned.items.map((it, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span
                  style={{ width: 8, height: 8, background: it.color, borderRadius: 2, flexShrink: 0 }}
                />
                <span>
                  {it.name}: {formatter(it.name, it.value)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
