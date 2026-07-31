import { useState } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'
import { formatCredits, colorAt } from '../../utils/format'
import { Pinnable } from './Pinnable'

interface Props {
  data: Record<string, number | string>[]
  keys: string[]
}

/** Stacked daily area chart: x = date, one stacked series per category key. Click a legend item to toggle it. */
export function StackedAreaChart({ data, keys }: Props) {
  const [hidden, setHidden] = useState<Record<string, boolean>>({})

  const toggle = (key: unknown) => {
    if (typeof key === 'string') setHidden((h) => ({ ...h, [key]: !h[key] }))
  }

  const legendFormatter = (value: string, entry: unknown) => {
    const key = (entry as { dataKey?: unknown })?.dataKey
    const off = typeof key === 'string' ? hidden[key] : false
    return (
      <span
        style={{
          color: off ? '#a6a6a6' : undefined,
          textDecoration: off ? 'line-through' : undefined,
          cursor: 'pointer',
        }}
      >
        {value}
      </span>
    )
  }

  return (
    <Pinnable formatter={(_, v) => formatCredits(v)}>
      {(onChartClick) => (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }} onClick={onChartClick}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={24} />
            <YAxis tickFormatter={(v) => formatCredits(v as number)} fontSize={11} />
            <Tooltip
              wrapperStyle={{ zIndex: 1000 }}
              contentStyle={{ maxWidth: 320, whiteSpace: 'normal', wordBreak: 'break-word' }}
              formatter={(v, n) => [formatCredits(v as number), String(n)]}
            />
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              onClick={(o: unknown) => toggle((o as { dataKey?: unknown })?.dataKey)}
              formatter={legendFormatter}
            />
            {keys.map((k, i) => (
              <Area
                key={k}
                type="monotone"
                dataKey={k}
                name={k}
                stackId="1"
                stroke={colorAt(i)}
                fill={colorAt(i)}
                fillOpacity={0.55}
                strokeWidth={1.25}
                hide={!!hidden[k]}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Pinnable>
  )
}
