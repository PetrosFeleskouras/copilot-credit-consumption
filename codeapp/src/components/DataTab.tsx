import { useMemo, useState } from 'react'
import {
  Table,
  TableHeader,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
  Input,
  Button,
  makeStyles,
  tokens,
  Text,
} from '@fluentui/react-components'
import {
  ArrowDownloadRegular,
  ArrowSortRegular,
  SearchRegular,
} from '@fluentui/react-icons'
import type { AgentDetailRow } from '../data/types'
import { exportToExcel } from '../utils/exportExcel'
import { formatCredits } from '../utils/format'

const useStyles = makeStyles({
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    marginBottom: tokens.spacingVerticalM,
    flexWrap: 'wrap',
  },
  search: { flexGrow: 1, minWidth: '320px', maxWidth: '560px' },
  spacer: { flex: 1 },
  wrap: { overflowX: 'auto', border: `1px solid ${tokens.colorNeutralStroke2}`, borderRadius: tokens.borderRadiusMedium },
  num: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
  pager: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: tokens.spacingHorizontalM,
    marginTop: tokens.spacingVerticalM,
  },
  sortable: { cursor: 'pointer', userSelect: 'none' },
})

type SortKey = 'billedCredit' | 'nonBilledCredit' | 'users' | 'reportDate' | null

const PAGE_SIZE = 100

interface Props {
  rows: AgentDetailRow[]
  periodLabel: string
}

export function DataTab({ rows, periodLabel }: Props) {
  const styles = useStyles()
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [sortKey, setSortKey] = useState<SortKey>('billedCredit')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let out = rows
    if (q) {
      out = rows.filter((r) =>
        [r.agentName, r.environmentName, r.feature, r.tool, r.llmModel, r.channel, r.knowledgeSources]
          .some((v) => v?.toLowerCase().includes(q))
      )
    }
    if (sortKey) {
      const dir = sortDir === 'asc' ? 1 : -1
      out = [...out].sort((a, b) => {
        const av = a[sortKey] ?? 0
        const bv = b[sortKey] ?? 0
        if (av < bv) return -1 * dir
        if (av > bv) return 1 * dir
        return 0
      })
    }
    return out
  }, [rows, query, sortKey, sortDir])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const clampedPage = Math.min(page, pageCount - 1)
  const pageRows = filtered.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE)

  function toggleSort(key: Exclude<SortKey, null>) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
    setPage(0)
  }

  return (
    <div>
      <div className={styles.toolbar}>
        <Input
          className={styles.search}
          contentBefore={<SearchRegular />}
          placeholder="Search agent, environment, tool, feature…"
          value={query}
          onChange={(_, d) => {
            setQuery(d.value)
            setPage(0)
          }}
        />
        <Text size={200}>{filtered.length.toLocaleString()} rows</Text>
        <div className={styles.spacer} />
        <Button
          appearance="primary"
          icon={<ArrowDownloadRegular />}
          onClick={() => void exportToExcel(filtered, periodLabel)}
        >
          Export to Excel
        </Button>
      </div>

      <div className={styles.wrap}>
        <Table size="small" aria-label="Credit consumption data">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Agent</TableHeaderCell>
              <TableHeaderCell>Environment</TableHeaderCell>
              <TableHeaderCell>Feature</TableHeaderCell>
              <TableHeaderCell>Tool</TableHeaderCell>
              <TableHeaderCell>Model</TableHeaderCell>
              <TableHeaderCell>Channel</TableHeaderCell>
              <TableHeaderCell>Knowledge source</TableHeaderCell>
              <TableHeaderCell className={styles.sortable} onClick={() => toggleSort('users')}>
                Users <ArrowSortRegular fontSize={12} />
              </TableHeaderCell>
              <TableHeaderCell className={styles.sortable} onClick={() => toggleSort('billedCredit')}>
                Billed <ArrowSortRegular fontSize={12} />
              </TableHeaderCell>
              <TableHeaderCell className={styles.sortable} onClick={() => toggleSort('nonBilledCredit')}>
                Non-billed <ArrowSortRegular fontSize={12} />
              </TableHeaderCell>
              <TableHeaderCell className={styles.sortable} onClick={() => toggleSort('reportDate')}>
                Date <ArrowSortRegular fontSize={12} />
              </TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((r, i) => (
              <TableRow key={clampedPage * PAGE_SIZE + i}>
                <TableCell>{r.agentName ?? '—'}</TableCell>
                <TableCell>{r.environmentName ?? '—'}</TableCell>
                <TableCell>{r.feature ?? '—'}</TableCell>
                <TableCell>{r.tool ?? '—'}</TableCell>
                <TableCell>{r.llmModel ?? '—'}</TableCell>
                <TableCell>{r.channel ?? '—'}</TableCell>
                <TableCell>{r.knowledgeSources ?? '—'}</TableCell>
                <TableCell className={styles.num}>{r.users}</TableCell>
                <TableCell className={styles.num}>{formatCredits(r.billedCredit)}</TableCell>
                <TableCell className={styles.num}>{formatCredits(r.nonBilledCredit)}</TableCell>
                <TableCell>{r.reportDate ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className={styles.pager}>
        <Button size="small" disabled={clampedPage === 0} onClick={() => setPage(clampedPage - 1)}>
          Previous
        </Button>
        <Text size={200}>
          Page {clampedPage + 1} of {pageCount}
        </Text>
        <Button
          size="small"
          disabled={clampedPage >= pageCount - 1}
          onClick={() => setPage(clampedPage + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  )
}
