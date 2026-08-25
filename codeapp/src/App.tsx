import { useMemo, useState } from 'react'
import {
  makeStyles,
  tokens,
  TabList,
  Tab,
  Text,
  Spinner,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
} from '@fluentui/react-components'
import { DataPieRegular, TableRegular, DataLineRegular, AppsRegular } from '@fluentui/react-icons'
import type { PeriodKey, DateRange, AgentDetailRow } from './data/types'
import { useAgentData } from './hooks/useAgentData'
import { buildPeriodOptions, defaultCustomRange, resolveRange } from './utils/periods'
import { CapacityBand } from './components/CapacityBand'
import { EntityFilters, type EntityFilterDef, type FilterOption } from './components/EntityFilters'
import { InsightsTab } from './components/InsightsTab'
import { BreakdownTab } from './components/BreakdownTab'
import { DataTab } from './components/DataTab'

const norm = (v: string | null) => (v && v.trim() ? v.trim() : null)

function stringOptions(values: (string | null)[]): FilterOption[] {
  const set = new Set<string>()
  for (const v of values) {
    const n = norm(v)
    if (n) set.add(n)
  }
  return [...set].sort((a, b) => a.localeCompare(b)).map((s) => ({ value: s, label: s }))
}

// Build id-keyed options; show full id in parentheses on duplicates, unnamed entries sorted last.
function idOptions(
  rows: AgentDetailRow[],
  nameFn: (r: AgentDetailRow) => string | null,
  idFn: (r: AgentDetailRow) => string | null,
): FilterOption[] {
  const idName = new Map<string, string>()
  for (const r of rows) {
    const id = idFn(r)
    if (!id) continue
    if (!idName.has(id)) idName.set(id, (nameFn(r) ?? '').trim())
  }
  const nameCount = new Map<string, number>()
  for (const nm of idName.values()) if (nm) nameCount.set(nm, (nameCount.get(nm) ?? 0) + 1)

  const named: FilterOption[] = []
  const unnamed: FilterOption[] = []
  for (const [id, nm] of idName) {
    if (!nm) {
      unnamed.push({ value: id, label: `(unnamed) (${id})` })
    } else {
      const dup = (nameCount.get(nm) ?? 0) > 1
      named.push({ value: id, label: dup ? `${nm} (${id})` : nm })
    }
  }
  named.sort((a, b) => a.label.localeCompare(b.label))
  unnamed.sort((a, b) => a.value.localeCompare(b.value))
  return [...named, ...unnamed]
}

const CREDIT_OPTIONS: FilterOption[] = [
  { value: 'Billed', label: 'Billed' },
  { value: 'Non-billed', label: 'Non-billed' },
]

interface FilterSelections {
  envs: string[]
  agents: string[]
  tools: string[]
  features: string[]
  channels: string[]
  models: string[]
  knowledge: string[]
  credit: string[]
}

function emptySelections(): FilterSelections {
  return { envs: [], agents: [], tools: [], features: [], channels: [], models: [], knowledge: [], credit: [] }
}

function rowsInRange(rows: AgentDetailRow[], range: DateRange) {
  return rows.filter(
    (row) => row.reportDate != null && row.reportDate >= range.from && row.reportDate <= range.to,
  )
}

function buildCascade(rows: AgentDetailRow[], selected: FilterSelections) {
  const applyId = (scopedRows: AgentDetailRow[], values: string[], idFn: (row: AgentDetailRow) => string | null) =>
    values.length ? scopedRows.filter((row) => { const value = idFn(row); return value != null && values.includes(value) }) : scopedRows
  const applyStr = (scopedRows: AgentDetailRow[], values: string[], valueFn: (row: AgentDetailRow) => string | null) =>
    values.length ? scopedRows.filter((row) => { const value = norm(valueFn(row)); return value != null && values.includes(value) }) : scopedRows

  let scopedRows = rows

  const envOptions = idOptions(scopedRows, (row) => row.environmentName, (row) => row.environmentId)
  const envs = selected.envs.filter((value) => envOptions.some((option) => option.value === value))
  scopedRows = applyId(scopedRows, envs, (row) => row.environmentId)

  const agentOptions = idOptions(scopedRows, (row) => row.agentName, (row) => row.agentId)
  const agents = selected.agents.filter((value) => agentOptions.some((option) => option.value === value))
  scopedRows = applyId(scopedRows, agents, (row) => row.agentId)

  const toolOptions = stringOptions(scopedRows.map((row) => row.tool))
  const tools = selected.tools.filter((value) => toolOptions.some((option) => option.value === value))
  scopedRows = applyStr(scopedRows, tools, (row) => row.tool)

  const featureOptions = stringOptions(scopedRows.map((row) => row.feature))
  const features = selected.features.filter((value) => featureOptions.some((option) => option.value === value))
  scopedRows = applyStr(scopedRows, features, (row) => row.feature)

  const channelOptions = stringOptions(scopedRows.map((row) => row.channel))
  const channels = selected.channels.filter((value) => channelOptions.some((option) => option.value === value))
  scopedRows = applyStr(scopedRows, channels, (row) => row.channel)

  const modelOptions = stringOptions(scopedRows.map((row) => row.llmModel))
  const models = selected.models.filter((value) => modelOptions.some((option) => option.value === value))
  scopedRows = applyStr(scopedRows, models, (row) => row.llmModel)

  const knowledgeOptions = stringOptions(scopedRows.map((row) => row.knowledgeSources))
  const knowledge = selected.knowledge.filter((value) => knowledgeOptions.some((option) => option.value === value))
  scopedRows = applyStr(scopedRows, knowledge, (row) => row.knowledgeSources)

  const wantBilled = selected.credit.includes('Billed')
  const wantNonBilled = selected.credit.includes('Non-billed')
  const filteredRows = selected.credit.length
    ? scopedRows.filter((row) => (wantBilled && row.billedCredit > 0) || (wantNonBilled && row.nonBilledCredit > 0))
    : scopedRows

  return {
    envOptions,
    agentOptions,
    toolOptions,
    featureOptions,
    channelOptions,
    modelOptions,
    knowledgeOptions,
    selections: { envs, agents, tools, features, channels, models, knowledge, credit: selected.credit },
    filteredRows,
  }
}

const useStyles = makeStyles({
  page: {
    minHeight: '100vh',
    width: '100%',
    boxSizing: 'border-box',
    overflowX: 'hidden',
    background: tokens.colorNeutralBackground3,
  },
  appbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalM,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalXXL}`,
    background: tokens.colorNeutralBackground1,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    flexWrap: 'wrap',
    boxSizing: 'border-box',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
  },
  waffle: {
    color: tokens.colorNeutralForeground3,
    fontSize: '20px',
    display: 'flex',
  },
  root: {
    width: '100%',
    boxSizing: 'border-box',
    margin: '0 auto',
    padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalXL}`,
  },
  titleWrap: { display: 'flex', flexDirection: 'column' },
  title: { fontWeight: tokens.fontWeightSemibold },
  subtitle: { color: tokens.colorNeutralForeground3 },
  tabs: { marginBottom: tokens.spacingVerticalL },
  center: { padding: tokens.spacingVerticalXXXL, textAlign: 'center' },
})

export default function App() {
  const styles = useStyles()
  const options = useMemo(() => buildPeriodOptions(), [])
  const [periodKey, setPeriodKey] = useState<PeriodKey>('mtd')
  const [customRange, setCustomRange] = useState<DateRange>(() => defaultCustomRange())
  const [tab, setTab] = useState<'insights' | 'breakdown' | 'data'>('insights')
  const range = useMemo(
    () => resolveRange(periodKey, options, customRange),
    [periodKey, options, customRange],
  )
  const { rows, all, dateRange, capacity, loading, error } = useAgentData(range)
  const periodLabel =
    periodKey === 'custom'
      ? `${customRange.from} → ${customRange.to}`
      : options.find((o) => o.key === periodKey)?.label ?? ''

  const [selections, setSelections] = useState<FilterSelections>(() => emptySelections())

  // Cascading options: each filter's choices come from the period-filtered rows narrowed by
  // all higher-level selections (period -> env -> agent -> tool -> feature -> channel -> model -> knowledge).
  const cascade = useMemo(() => buildCascade(rows, selections), [rows, selections])

  const filteredRows = cascade.filteredRows

  const changeSelection = (key: keyof FilterSelections, values: string[]) => {
    setSelections((current) => buildCascade(rows, { ...current, [key]: values }).selections)
  }

  const pruneForRange = (nextRange: DateRange) => {
    const nextRows = rowsInRange(all, nextRange)
    setSelections((current) => buildCascade(nextRows, current).selections)
  }

  const changePeriod = (key: PeriodKey) => {
    setPeriodKey(key)
    pruneForRange(resolveRange(key, options, customRange))
  }

  const changeCustomRange = (nextRange: DateRange) => {
    setCustomRange(nextRange)
    pruneForRange(nextRange)
  }

  const entityFilters: EntityFilterDef[] = [
    { key: 'env', label: 'Environment', allLabel: 'All Environments', options: cascade.envOptions, values: cascade.selections.envs, onChange: (values) => changeSelection('envs', values), limit: 2000 },
    { key: 'agent', label: 'Agent', allLabel: 'All Agents', options: cascade.agentOptions, values: cascade.selections.agents, onChange: (values) => changeSelection('agents', values), limit: 1000 },
    { key: 'tool', label: 'Tool', allLabel: 'All Tools', options: cascade.toolOptions, values: cascade.selections.tools, onChange: (values) => changeSelection('tools', values) },
    { key: 'feature', label: 'Feature', allLabel: 'All Features', options: cascade.featureOptions, values: cascade.selections.features, onChange: (values) => changeSelection('features', values) },
    { key: 'channel', label: 'Channel', allLabel: 'All Channels', options: cascade.channelOptions, values: cascade.selections.channels, onChange: (values) => changeSelection('channels', values) },
    { key: 'model', label: 'LLM model', allLabel: 'All Models', options: cascade.modelOptions, values: cascade.selections.models, onChange: (values) => changeSelection('models', values) },
    { key: 'knowledge', label: 'Knowledge source', allLabel: 'All Knowledge', options: cascade.knowledgeOptions, values: cascade.selections.knowledge, onChange: (values) => changeSelection('knowledge', values) },
    { key: 'credit', label: 'Credit type', allLabel: 'All credit', options: CREDIT_OPTIONS, values: cascade.selections.credit, onChange: (values) => changeSelection('credit', values) },
  ]

  const resetFilters = () => {
    setPeriodKey('mtd')
    setCustomRange(defaultCustomRange())
    setSelections(emptySelections())
  }

  return (
    <div className={styles.page}>
      <div className={styles.appbar}>
        <div className={styles.brand}>
          <span className={styles.waffle}>
            <AppsRegular />
          </span>
          <div className={styles.titleWrap}>
            <Text size={400} className={styles.title}>
              Copilot Credit Insights
            </Text>
          </div>
        </div>
      </div>

      <div className={styles.root}>
        {error && (
          <MessageBar intent="error">
            <MessageBarBody>
              <MessageBarTitle>Could not load data.</MessageBarTitle>
              {error}
            </MessageBarBody>
          </MessageBar>
        )}

        {loading ? (
          <div className={styles.center}>
            <Spinner label="Loading consumption data…" />
          </div>
        ) : (
          <>
            {capacity && <CapacityBand capacity={capacity} />}

            <EntityFilters
              periodOptions={options}
              selectedKey={periodKey}
              onSelectKey={changePeriod}
              customRange={customRange}
              onCustomChange={changeCustomRange}
              dateRange={dateRange}
              filters={entityFilters}
              onReset={resetFilters}
            />

            <TabList
              className={styles.tabs}
              selectedValue={tab}
              onTabSelect={(_, d) => setTab(d.value as 'insights' | 'breakdown' | 'data')}
            >
              <Tab value="insights" icon={<DataPieRegular />}>
                Insights
              </Tab>
              <Tab value="breakdown" icon={<DataLineRegular />}>
                Breakdown
              </Tab>
              <Tab value="data" icon={<TableRegular />}>
                Data
              </Tab>
            </TabList>

            {tab === 'insights' ? (
              <InsightsTab rows={filteredRows} />
            ) : tab === 'breakdown' ? (
              <BreakdownTab rows={filteredRows} periodLabel={periodLabel} />
            ) : (
              <DataTab rows={filteredRows} periodLabel={periodLabel} />
            )}
          </>
        )}
      </div>
    </div>
  )
}
