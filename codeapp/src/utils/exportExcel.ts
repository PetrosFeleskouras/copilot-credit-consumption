import ExcelJS from 'exceljs'
import type { AgentDetailRow } from '../data/types'

const COLUMNS: { header: string; key: keyof AgentDetailRow; width: number; numeric?: boolean }[] = [
  { header: 'Agent', key: 'agentName', width: 34 },
  { header: 'Environment', key: 'environmentName', width: 30 },
  { header: 'Feature', key: 'feature', width: 26 },
  { header: 'Tool', key: 'tool', width: 24 },
  { header: 'LLM Model', key: 'llmModel', width: 18 },
  { header: 'Channel', key: 'channel', width: 14 },
  { header: 'Knowledge Sources', key: 'knowledgeSources', width: 22 },
  { header: 'Users', key: 'users', width: 10, numeric: true },
  { header: 'Billed Credit', key: 'billedCredit', width: 14, numeric: true },
  { header: 'Non-billed Credit', key: 'nonBilledCredit', width: 16, numeric: true },
  { header: 'Report Date', key: 'reportDate', width: 14 },
]

/** Build an .xlsx from the current (filtered) rows and trigger a download. */
export async function exportToExcel(rows: AgentDetailRow[], periodLabel: string): Promise<void> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Copilot Credit Insights'
  wb.created = new Date()
  const ws = wb.addWorksheet('Consumption')

  ws.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key as string, width: c.width }))
  ws.getRow(1).font = { bold: true }
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F6CBD' } }
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }

  for (const r of rows) {
    ws.addRow({
      agentName: r.agentName ?? '',
      environmentName: r.environmentName ?? '',
      feature: r.feature ?? '',
      tool: r.tool ?? '',
      llmModel: r.llmModel ?? '',
      channel: r.channel ?? '',
      knowledgeSources: r.knowledgeSources ?? '',
      users: r.users,
      billedCredit: r.billedCredit,
      nonBilledCredit: r.nonBilledCredit,
      reportDate: r.reportDate ?? '',
    })
  }

  ws.autoFilter = { from: 'A1', to: 'K1' }
  ws.views = [{ state: 'frozen', ySplit: 1 }]

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const safeLabel =
    periodLabel.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'export'
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `copilot-credit-consumption-${safeLabel}.xlsx`
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  // Defer cleanup so the browser can start the download before the URL is revoked.
  setTimeout(() => {
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 1000)
}
