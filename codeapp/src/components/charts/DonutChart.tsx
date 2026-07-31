import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts'
import type { NameValue } from '../../insights/aggregations'
import { colorAt, formatCredits, truncate } from '../../utils/format'

interface Props {
  data: NameValue[]
  maxSlices?: number
}

export function DonutChart({ data, maxSlices = 8 }: Props) {
  // collapse the long tail into "Other"
  let sliced = data
  if (data.length > maxSlices) {
    const head = data.slice(0, maxSlices - 1)
    const otherVal = data.slice(maxSlices - 1).reduce((acc, d) => acc + d.value, 0)
    sliced = [...head, { name: 'Other', value: Math.round(otherVal * 100) / 100 }]
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={sliced}
          dataKey="value"
          nameKey="name"
          innerRadius="52%"
          outerRadius="80%"
          paddingAngle={1}
        >
          {sliced.map((_, i) => (
            <Cell key={i} fill={colorAt(i)} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ maxWidth: 320, whiteSpace: 'normal', wordBreak: 'break-word' }}
          formatter={(v, n) => [formatCredits(v as number), String(n)]}
        />
        <Legend
          formatter={(v) => truncate(String(v), 20)}
          wrapperStyle={{ fontSize: 11 }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
