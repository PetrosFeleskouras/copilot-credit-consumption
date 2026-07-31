import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts'
import type { NameValue } from '../../insights/aggregations'
import { colorAt, formatCredits, truncate } from '../../utils/format'
import { Pinnable } from './Pinnable'

interface Props {
  data: NameValue[]
  valueLabel?: string
  color?: string
  multicolor?: boolean
}

export function RankBarChart({ data, valueLabel = 'Credits', color = '#1E8A76', multicolor = false }: Props) {
  return (
    <Pinnable formatter={(_, v) => formatCredits(v)}>
      {(onChartClick) => (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }} onClick={onChartClick}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tickFormatter={(v) => formatCredits(v as number)} fontSize={11} />
            <YAxis
              type="category"
              dataKey="name"
              width={140}
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => truncate(String(v), 22)}
            />
            <Tooltip
              formatter={(v) => [formatCredits(v as number), valueLabel]}
              labelStyle={{ fontWeight: 600, whiteSpace: 'normal', wordBreak: 'break-word' }}
              allowEscapeViewBox={{ x: true, y: true }}
              wrapperStyle={{ zIndex: 1000 }}
              contentStyle={{ maxWidth: 320, whiteSpace: 'normal', wordBreak: 'break-word' }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} fill={color}>
              {multicolor && data.map((_, i) => <Cell key={i} fill={colorAt(i)} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Pinnable>
  )
}
