// Shape of one Copilot credit-consumption row (name-first fields).
// Mirrors cat_agentdetail in Dataverse.
export interface AgentDetailRow {
  agentName: string | null
  agentId: string | null
  environmentName: string | null
  environmentId: string | null
  feature: string | null
  tool: string | null
  llmModel: string | null
  channel: string | null
  knowledgeSources: string | null
  users: number
  billedCredit: number
  nonBilledCredit: number
  reportDate: string | null // yyyy-MM-dd
  lookbackDays: number // always 1 (true daily grain)
}

export interface SnapshotMeta {
  currentBatch: string
  generatedAt: string
  totalRows: number
  byWindow: { lookbackDays: number; rows: number }[]
}

// Tenant-level Copilot capacity snapshot (mirrors cat_tenantcapacity in Dataverse;
// sourced from licensing API /v2.0/tenants/{tid}/entitlements/MCSMessages).
export interface TenantCapacity {
  capacityType: string
  unit: string
  entitled: number
  consumed: number
  allocated: number
  available: number
  payGoConsumed: number
  status: string | null
  asOfDate: string | null // yyyy-MM-dd
}

// Inclusive date range (yyyy-MM-dd) used to filter the daily-grain rows.
export interface DateRange {
  from: string
  to: string
}

// Named time-period selections shown in the filter dropdown.
export type PeriodKey = 'mtd' | 'prevMonth' | 'prevMonth2' | 'last3m' | 'custom'

export interface PeriodOption {
  key: PeriodKey
  label: string
  range: DateRange
}
