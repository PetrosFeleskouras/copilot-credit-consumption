import { useMemo } from 'react'
import { makeStyles, tokens, Text } from '@fluentui/react-components'
import type { AgentDetailRow } from '../data/types'
import { costSummary, agentPareto, rankings, distributions, adoption, dailySeries } from '../insights/aggregations'
import { KpiCards } from './KpiCards'
import { ChartCard } from './charts/ChartCard'
import { RankBarChart } from './charts/RankBarChart'
import { DonutChart } from './charts/DonutChart'
import { ParetoChart } from './charts/ParetoChart'
import { TrendChart } from './charts/TrendChart'

const useStyles = makeStyles({
  wrap: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalL },
  caption: { color: tokens.colorNeutralForeground3 },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
    gap: tokens.spacingHorizontalL,
  },
  empty: {
    padding: tokens.spacingVerticalXXXL,
    textAlign: 'center',
    color: tokens.colorNeutralForeground3,
  },
})

interface Props {
  rows: AgentDetailRow[]
}

export function InsightsTab({ rows }: Props) {
  const styles = useStyles()

  const summary = useMemo(() => costSummary(rows), [rows])
  const pareto = useMemo(() => agentPareto(rows), [rows])
  const rank = useMemo(() => rankings(rows), [rows])
  const dist = useMemo(() => distributions(rows), [rows])
  const adopt = useMemo(() => adoption(rows), [rows])
  const daily = useMemo(() => dailySeries(rows), [rows])

  if (rows.length === 0) {
    return (
      <div className={styles.empty}>
        <Text>No data for the selected filters.</Text>
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      <KpiCards summary={summary} />

      <ChartCard
        title="Total capacity consumption trend"
        subtitle="Cumulative credits over the selected period & filters"
        height={320}
      >
        <TrendChart data={daily} />
      </ChartCard>

      <div className={styles.grid}>
        <ChartCard title="Cost concentration (top agents)" subtitle="Credits + cumulative %">
          <ParetoChart data={pareto} />
        </ChartCard>
        <ChartCard title="Top agents" subtitle="By total credits">
          <RankBarChart data={rank.agents} multicolor />
        </ChartCard>
        <ChartCard title="Top environments" subtitle="By total credits">
          <RankBarChart data={rank.environments} multicolor />
        </ChartCard>
        <ChartCard title="Top tools" subtitle="By total credits">
          <RankBarChart data={rank.tools} multicolor />
        </ChartCard>
        <ChartCard title="Top features" subtitle="By total credits">
          <RankBarChart data={rank.features} multicolor />
        </ChartCard>
        <ChartCard title="Top channels" subtitle="By total credits">
          <RankBarChart data={rank.channels} multicolor />
        </ChartCard>
        <ChartCard title="Top LLM models" subtitle="By total credits">
          <RankBarChart data={rank.models} multicolor />
        </ChartCard>
        <ChartCard title="Top knowledge sources" subtitle="By total credits">
          <RankBarChart data={dist.byKnowledgeSource.slice(0, 10)} multicolor />
        </ChartCard>
        <ChartCard title="Active vs dormant" subtitle="Environments with any billed credit">
          <DonutChart data={adopt.activeVsDormant} />
        </ChartCard>
      </div>
    </div>
  )
}
