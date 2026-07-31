import { useMemo } from 'react'
import { makeStyles, tokens, Text } from '@fluentui/react-components'
import type { AgentDetailRow } from '../data/types'
import { dailyByDimension } from '../insights/aggregations'
import { ChartCard } from './charts/ChartCard'
import { StackedAreaChart } from './charts/StackedAreaChart'

const useStyles = makeStyles({
  head: { marginBottom: tokens.spacingVerticalXS, fontWeight: tokens.fontWeightSemibold },
  desc: {
    color: tokens.colorNeutralForeground3,
    marginBottom: tokens.spacingVerticalL,
    maxWidth: '820px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
    gap: tokens.spacingHorizontalL,
  },
  empty: { padding: tokens.spacingVerticalXXXL, textAlign: 'center', color: tokens.colorNeutralForeground3 },
})

interface Props {
  rows: AgentDetailRow[]
  periodLabel: string
}

export function BreakdownTab({ rows, periodLabel }: Props) {
  const styles = useStyles()

  const total = useMemo(() => dailyByDimension(rows, () => 'Total'), [rows])
  const byTool = useMemo(() => dailyByDimension(rows, (r) => r.tool, { dropBlank: true }), [rows])
  const byFeature = useMemo(() => dailyByDimension(rows, (r) => r.feature), [rows])
  const byChannel = useMemo(() => dailyByDimension(rows, (r) => r.channel), [rows])
  const byModel = useMemo(() => dailyByDimension(rows, (r) => r.llmModel, { dropBlank: true }), [rows])
  const byKnowledge = useMemo(
    () => dailyByDimension(rows, (r) => r.knowledgeSources, { dropBlank: true }),
    [rows],
  )

  if (rows.length === 0) {
    return (
      <div className={styles.empty}>
        <Text>No data for the selected time period, environments and agents.</Text>
      </div>
    )
  }

  return (
    <div>
      <Text size={500} className={styles.head} as="h2" block>
        Daily consumption breakdown
      </Text>

      <div className={styles.grid}>
        <ChartCard title="Total credits per day" subtitle={periodLabel} height={300}>
          <StackedAreaChart data={total.data} keys={total.keys} />
        </ChartCard>
        <ChartCard title="By tool" subtitle="Top tools per day" height={300}>
          <StackedAreaChart data={byTool.data} keys={byTool.keys} />
        </ChartCard>
        <ChartCard title="By feature" subtitle="Top features per day" height={300}>
          <StackedAreaChart data={byFeature.data} keys={byFeature.keys} />
        </ChartCard>
        <ChartCard title="By channel" subtitle="Top channels per day" height={300}>
          <StackedAreaChart data={byChannel.data} keys={byChannel.keys} />
        </ChartCard>
        <ChartCard title="By LLM model" subtitle="Top models per day" height={300}>
          <StackedAreaChart data={byModel.data} keys={byModel.keys} />
        </ChartCard>
        <ChartCard title="By knowledge source" subtitle="Top knowledge sources per day" height={300}>
          <StackedAreaChart data={byKnowledge.data} keys={byKnowledge.keys} />
        </ChartCard>
      </div>
    </div>
  )
}
