import { Card, Text, makeStyles, tokens } from '@fluentui/react-components'
import type { CostSummary } from '../insights/aggregations'
import { formatCredits, formatInt } from '../utils/format'

const useStyles = makeStyles({
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: tokens.spacingHorizontalM,
    marginBottom: tokens.spacingVerticalL,
  },
  card: {
    padding: tokens.spacingVerticalM,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXXS,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    boxShadow: tokens.shadow2,
  },
  value: {
    fontSize: tokens.fontSizeHero700,
    fontWeight: tokens.fontWeightSemibold,
    lineHeight: '1.1',
  },
  label: {
    color: tokens.colorNeutralForeground3,
  },
  accent: { color: tokens.colorBrandForeground1 },
})

interface Props {
  summary: CostSummary
}

export function KpiCards({ summary }: Props) {
  const styles = useStyles()
  const items: { label: string; value: string; accent?: boolean }[] = [
    { label: 'Total credits', value: formatCredits(summary.totalCredit), accent: true },
    { label: 'Billed', value: formatCredits(summary.totalBilled) },
    { label: 'Non-billed', value: formatCredits(summary.totalNonBilled) },
    { label: 'Agents', value: formatInt(summary.agentCount) },
    { label: 'Environments', value: formatInt(summary.environmentCount) },
  ]
  return (
    <div className={styles.grid}>
      {items.map((it) => (
        <Card key={it.label} className={styles.card}>
          <Text className={`${styles.value} ${it.accent ? styles.accent : ''}`}>{it.value}</Text>
          <Text size={200} className={styles.label}>
            {it.label}
          </Text>
        </Card>
      ))}
    </div>
  )
}
