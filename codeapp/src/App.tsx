import { useEffect, useMemo, useState } from 'react'
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
  const { rows, dateRange, capacity, loading, error } = useAgentData(range)
  const periodLabel =
    periodKey === 'custom'
      ? `${customRange.from} → ${customRange.to}`
      : options.find((o) => o.key === periodKey)?.label ?? ''

  const [selectedEnvs, setSelectedEnvs] = useState<string[]>([])
  const [selectedAgents, setSelectedAgents] = useState<string[]>([])
  const [selectedTools, setSelectedTools] = useState<string[]>([])
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([])
  const [selectedChannels, setSelectedChannels] = useState<string[]>([])
  const [selectedModels, setSelectedModels] = useState<string[]>([])
  const [selectedKnowledge, setSelectedKnowledge] = useState<string[]>([])
  const [selectedCredit, setSelectedCredit] = useState<string[]>([])

  // Cascading options: each filter's choices come from the period-filtered rows narrowed by
  // all higher-level selections (period -> env -> agent -> tool -> feature -> channel -> model -> knowledge).
  const cascade = useMemo(() => {
    const applyId = (rs: AgentDetailRow[], sel: string[], idFn: (r: AgentDetailRow) => string | null) =>
      sel.length ? rs.filter((r) => { const v = idFn(r); return v != null && sel.includes(v) }) : rs
    const applyStr = (rs: AgentDetailRow[], sel: string[], valFn: (r: AgentDetailRow) => string | null) =>
      sel.length ? rs.filter((r) => { const v = norm(valFn(r)); return v != null && sel.includes(v) }) : rs

    let r = rows

    const envOptions = idOptions(r, (x) => x.environmentName, (x) => x.environmentId)
    const envs = selectedEnvs.filter((v) => envOptions.some((o) => o.value === v))
    r = applyId(r, envs, (x) => x.environmentId)

    const agentOptions = idOptions(r, (x) => x.agentName, (x) => x.agentId)
    const agents = selectedAgents.filter((v) => agentOptions.some((o) => o.value === v))
    r = applyId(r, agents, (x) => x.agentId)

    const toolOptions = stringOptions(r.map((x) => x.tool))
    const tools = selectedTools.filter((v) => toolOptions.some((o) => o.value === v))
    r = applyStr(r, tools, (x) => x.tool)

    const featureOptions = stringOptions(r.map((x) => x.feature))
    const features = selectedFeatures.filter((v) => featureOptions.some((o) => o.value === v))
    r = applyStr(r, features, (x) => x.feature)

    const channelOptions = stringOptions(r.map((x) => x.channel))
    const channels = selectedChannels.filter((v) => channelOptions.some((o) => o.value === v))
    r = applyStr(r, channels, (x) => x.channel)

    const modelOptions = stringOptions(r.map((x) => x.llmModel))
    const models = selectedModels.filter((v) => modelOptions.some((o) => o.value === v))
    r = applyStr(r, models, (x) => x.llmModel)

    const knowledgeOptions = stringOptions(r.map((x) => x.knowledgeSources))
    const knowledge = selectedKnowledge.filter((v) => knowledgeOptions.some((o) => o.value === v))
    r = applyStr(r, knowledge, (x) => x.knowledgeSources)

    const wantBilled = selectedCredit.includes('Billed')
    const wantNon = selectedCredit.includes('Non-billed')
    const filteredRows = selectedCredit.length
      ? r.filter((x) => (wantBilled && x.billedCredit > 0) || (wantNon && x.nonBilledCredit > 0))
      : r

    return {
      envOptions, agentOptions, toolOptions, featureOptions, channelOptions, modelOptions, knowledgeOptions,
      pruned: { envs, agents, tools, features, channels, models, knowledge },
      filteredRows,
    }
  }, [rows, selectedEnvs, selectedAgents, selectedTools, selectedFeatures, selectedChannels, selectedModels, selectedKnowledge, selectedCredit])

  const filteredRows = cascade.filteredRows

  // Drop selections that are no longer available after a higher-level or period change.
  useEffect(() => {
    const p = cascade.pruned
    const diff = (a: string[], b: string[]) => a.length !== b.length || a.some((x, i) => x !== b[i])
    if (diff(p.envs, selectedEnvs)) setSelectedEnvs(p.envs)
    if (diff(p.agents, selectedAgents)) setSelectedAgents(p.agents)
    if (diff(p.tools, selectedTools)) setSelectedTools(p.tools)
    if (diff(p.features, selectedFeatures)) setSelectedFeatures(p.features)
    if (diff(p.channels, selectedChannels)) setSelectedChannels(p.channels)
    if (diff(p.models, selectedModels)) setSelectedModels(p.models)
    if (diff(p.knowledge, selectedKnowledge)) setSelectedKnowledge(p.knowledge)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cascade])

  const entityFilters: EntityFilterDef[] = [
    { key: 'env', label: 'Environment', allLabel: 'All Environments', options: cascade.envOptions, values: selectedEnvs, onChange: setSelectedEnvs, limit: 2000 },
    { key: 'agent', label: 'Agent', allLabel: 'All Agents', options: cascade.agentOptions, values: selectedAgents, onChange: setSelectedAgents, limit: 1000 },
    { key: 'tool', label: 'Tool', allLabel: 'All Tools', options: cascade.toolOptions, values: selectedTools, onChange: setSelectedTools },
    { key: 'feature', label: 'Feature', allLabel: 'All Features', options: cascade.featureOptions, values: selectedFeatures, onChange: setSelectedFeatures },
    { key: 'channel', label: 'Channel', allLabel: 'All Channels', options: cascade.channelOptions, values: selectedChannels, onChange: setSelectedChannels },
    { key: 'model', label: 'LLM model', allLabel: 'All Models', options: cascade.modelOptions, values: selectedModels, onChange: setSelectedModels },
    { key: 'knowledge', label: 'Knowledge source', allLabel: 'All Knowledge', options: cascade.knowledgeOptions, values: selectedKnowledge, onChange: setSelectedKnowledge },
    { key: 'credit', label: 'Credit type', allLabel: 'All credit', options: CREDIT_OPTIONS, values: selectedCredit, onChange: setSelectedCredit },
  ]

  const resetFilters = () => {
    setPeriodKey('mtd')
    setCustomRange(defaultCustomRange())
    setSelectedEnvs([])
    setSelectedAgents([])
    setSelectedTools([])
    setSelectedFeatures([])
    setSelectedChannels([])
    setSelectedModels([])
    setSelectedKnowledge([])
    setSelectedCredit([])
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
              onSelectKey={setPeriodKey}
              customRange={customRange}
              onCustomChange={setCustomRange}
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
