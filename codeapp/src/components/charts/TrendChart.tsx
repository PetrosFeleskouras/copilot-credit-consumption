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
import type { DailyPoint } from '../../insights/aggregations'
import { formatCredits } from '../../utils/format'
import { Pinnable } from './Pinnable'

interface Props {
  data: DailyPoint[]
}

/** Cumulative (running-total) credit consumption over the selected period. */
export function TrendChart({ data }: Props) {
  return (
    <Pinnable formatter={(_, v) => formatCredits(v)}>
      {(onChartClick) => (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }} onClick={onChartClick}>
            <defs>
              <linearGradient id="cumFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1E8A76" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#1E8A76" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={24} />
            <YAxis tickFormatter={(v) => formatCredits(v as number)} fontSize={11} />
            <Tooltip
              wrapperStyle={{ zIndex: 1000 }}
              formatter={(v, n) => [formatCredits(v as number), String(n)]}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area
              type="monotone"
              dataKey="cumulative"
              name="Cumulative credits"
              stroke="#1E8A76"
              strokeWidth={1.75}
              fill="url(#cumFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Pinnable>
  )
}
