import { Card, Text, Badge, ProgressBar, makeStyles, tokens } from '@fluentui/react-components'
import type { TenantCapacity } from '../data/types'
import { formatInt } from '../utils/format'

const useStyles = makeStyles({
  card: {
    padding: tokens.spacingVerticalM,
    marginBottom: tokens.spacingVerticalL,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    boxShadow: tokens.shadow2,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalM,
    flexWrap: 'wrap',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  title: { fontWeight: tokens.fontWeightSemibold },
  asOf: { color: tokens.colorNeutralForeground3 },
  bar: { marginTop: tokens.spacingVerticalXXS },
  stats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: tokens.spacingHorizontalM,
    marginTop: tokens.spacingVerticalXS,
  },
  stat: { display: 'flex', flexDirection: 'column', gap: '2px' },
  statValue: { fontWeight: tokens.fontWeightSemibold, fontSize: tokens.fontSizeBase500 },
  statLabel: { color: tokens.colorNeutralForeground3 },
})

interface Props {
  capacity: TenantCapacity
}

export function CapacityBand({ capacity }: Props) {
  const styles = useStyles()
  const { entitled, consumed, allocated, available, payGoConsumed, status, asOfDate } = capacity

  const usedPct = entitled > 0 ? consumed / entitled : 0
  const allocatedPct = entitled > 0 ? Math.min(allocated / entitled, 1) : 0
  const withinCapacity = (status ?? '').toLowerCase() === 'withincapacity'

  return (
    <Card className={styles.card}>
      <div className={styles.headerRow}>
        <div className={styles.headerLeft}>
          <Text size={400} className={styles.title}>
            Copilot message capacity (tenant)
          </Text>
          {status && (
            <Badge appearance="tint" color={withinCapacity ? 'success' : 'warning'}>
              {withinCapacity ? 'Within capacity' : status}
            </Badge>
          )}
        </div>
        {asOfDate && (
          <Text size={200} className={styles.asOf}>
            As of {asOfDate}
          </Text>
        )}
      </div>

      <ProgressBar
        className={styles.bar}
        value={usedPct}
        max={1}
        thickness="large"
        color={withinCapacity ? 'success' : 'warning'}
      />

      <div className={styles.stats}>
        <div className={styles.stat}>
          <Text className={styles.statValue}>{formatInt(Math.round(entitled))}</Text>
          <Text size={200} className={styles.statLabel}>Entitled</Text>
        </div>
        <div className={styles.stat}>
          <Text className={styles.statValue}>
            {formatInt(Math.round(consumed))} ({(usedPct * 100).toFixed(1)}%)
          </Text>
          <Text size={200} className={styles.statLabel}>Consumed (MTD)</Text>
        </div>
        <div className={styles.stat}>
          <Text className={styles.statValue}>
            {formatInt(Math.round(allocated))} ({(allocatedPct * 100).toFixed(1)}%)
          </Text>
          <Text size={200} className={styles.statLabel}>Allocated</Text>
        </div>
        <div className={styles.stat}>
          <Text className={styles.statValue}>{formatInt(Math.round(available))}</Text>
          <Text size={200} className={styles.statLabel}>Available</Text>
        </div>
        <div className={styles.stat}>
          <Text className={styles.statValue}>{formatInt(Math.round(payGoConsumed))}</Text>
          <Text size={200} className={styles.statLabel}>PayGo (MTD)</Text>
        </div>
      </div>
    </Card>
  )
}
