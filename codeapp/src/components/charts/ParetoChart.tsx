import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'
import type { ParetoPoint } from '../../insights/aggregations'
import { formatCredits, truncate } from '../../utils/format'
import { Pinnable } from './Pinnable'

interface Props {
  data: ParetoPoint[]
}

export function ParetoChart({ data }: Props) {
  return (
    <Pinnable formatter={(name, v) => (name.toLowerCase().includes('cumulative') ? `${v}%` : formatCredits(v))}>
      {(onChartClick) => (
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 40, left: 4 }} onClick={onChartClick}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="name"
              angle={-40}
              textAnchor="end"
              height={60}
              interval={0}
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => truncate(String(v), 16)}
            />
            <YAxis yAxisId="left" tickFormatter={(v) => formatCredits(v as number)} fontSize={11} />
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              fontSize={11}
            />
            <Tooltip
              wrapperStyle={{ zIndex: 1000 }}
              contentStyle={{ maxWidth: 320, whiteSpace: 'normal', wordBreak: 'break-word' }}
              formatter={(v, n) =>
                n === 'cumulativePct'
                  ? [`${v}%`, 'Cumulative']
                  : [formatCredits(v as number), 'Credits']
              }
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar yAxisId="left" dataKey="value" name="Credits" fill="#1E8A76" radius={[4, 4, 0, 0]} />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="cumulativePct"
              name="Cumulative %"
              stroke="#C4314B"
              strokeWidth={2}
              dot={{ r: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </Pinnable>
  )
}
