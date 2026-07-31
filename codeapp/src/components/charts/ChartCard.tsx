import type { ReactNode } from 'react'
import { Card, CardHeader, Text, makeStyles, tokens } from '@fluentui/react-components'

const useStyles = makeStyles({
  card: {
    height: '100%',
    overflow: 'visible',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    boxShadow: tokens.shadow2,
    borderRadius: tokens.borderRadiusMedium,
  },
  body: {
    paddingTop: tokens.spacingVerticalS,
    height: '260px',
    overflow: 'visible',
    position: 'relative',
  },
  subtitle: {
    color: tokens.colorNeutralForeground3,
  },
})

interface ChartCardProps {
  title: string
  subtitle?: string
  children: ReactNode
  height?: number
}

export function ChartCard({ title, subtitle, children, height = 260 }: ChartCardProps) {
  const styles = useStyles()
  return (
    <Card className={styles.card}>
      <CardHeader
        header={<Text weight="semibold">{title}</Text>}
        description={subtitle ? <Text size={200} className={styles.subtitle}>{subtitle}</Text> : undefined}
      />
      <div className={styles.body} style={{ height }}>
        {children}
      </div>
    </Card>
  )
}
