import { useEffect, useMemo, useState } from 'react'
import type { AgentDetailRow, SnapshotMeta, DateRange, TenantCapacity } from '../data/types'
import { loadAgentDetails, loadMeta, loadTenantCapacity } from '../data/dataProvider'

interface State {
  all: AgentDetailRow[]
  meta: SnapshotMeta | null
  capacity: TenantCapacity | null
  loading: boolean
  error: string | null
}

export function useAgentData(range: DateRange) {
  const [state, setState] = useState<State>({ all: [], meta: null, capacity: null, loading: true, error: null })

  useEffect(() => {
    let cancelled = false
    setState((s) => ({ ...s, loading: true, error: null }))
    Promise.all([loadAgentDetails(), loadMeta(), loadTenantCapacity()])
      .then(([all, meta, capacity]) => {
        if (!cancelled) setState({ all, meta, capacity, loading: false, error: null })
      })
      .catch((e: unknown) => {
        if (!cancelled) setState({ all: [], meta: null, capacity: null, loading: false, error: e instanceof Error ? e.message : String(e) })
      })
    return () => {
      cancelled = true
    }
  }, [])

  // filter to the selected inclusive date range (true daily grain -> safe to sum)
  const rows = useMemo(() => {
    return state.all.filter(
      (r) => r.reportDate != null && r.reportDate >= range.from && r.reportDate <= range.to,
    )
  }, [state.all, range.from, range.to])

  const dateRange = useMemo(() => {
    const dates = rows.map((r) => r.reportDate).filter((d): d is string => !!d)
    if (dates.length === 0) return null
    dates.sort()
    return { from: dates[0], to: dates[dates.length - 1] }
  }, [rows])

  return { rows, all: state.all, dateRange, meta: state.meta, capacity: state.capacity, loading: state.loading, error: state.error }
}
