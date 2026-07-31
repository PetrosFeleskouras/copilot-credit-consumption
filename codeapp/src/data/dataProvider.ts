/**
 * dataProvider.ts
 * 
 * Data provider for Power Apps Code App - fetches from Dataverse.
 * Maps Dataverse cat_ fields to AgentDetailRow camelCase fields.
 */

import { Cat_agentdetailsService } from '../generated/services/Cat_agentdetailsService';
import { Cat_syncmetadatasService } from '../generated/services/Cat_syncmetadatasService';
import { Cat_tenantcapacitiesService } from '../generated/services/Cat_tenantcapacitiesService';
import type { Cat_agentdetails } from '../generated/models/Cat_agentdetailsModel';
import type { Cat_tenantcapacities } from '../generated/models/Cat_tenantcapacitiesModel';
import type { AgentDetailRow, SnapshotMeta, TenantCapacity } from './types';

/**
 * Load all agent detail rows from Dataverse (current batch).
 */
export async function loadAgentDetails(): Promise<AgentDetailRow[]> {
  try {
    // Fetch daily-grain agent details for the last 180 days.
    // Rows are true per-day deltas (cat_lookbackdays = 1). We filter by date
    // server-side so the query stays bounded even as history grows without limit.
    // Dataverse returns at most one page per request (default max 5000 rows),
    // so we follow the skipToken until every page has been retrieved.
    const select = [
      'cat_agentname',
      'cat_agentid',
      'cat_environmentname',
      'cat_environmentid',
      'cat_feature',
      'cat_tool',
      'cat_llmmodel',
      'cat_channel',
      'cat_knowledgesources',
      'cat_users',
      'cat_billedcredit',
      'cat_nonbilledcredit',
      'cat_reportdate',
      'cat_lookbackdays'
    ];
    // Daily grain, last 180 days (server-side date filter).
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - 180);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    const filter = `cat_lookbackdays eq 1 and cat_reportdate ge ${cutoffStr}`;

    const raw: Cat_agentdetails[] = [];
    let skipToken: string | undefined = undefined;
    do {
      const rawPage = await Cat_agentdetailsService.getAll({
        select,
        filter,
        maxPageSize: 5000,
        skipToken
      });
      raw.push(...rawPage.data);
      skipToken = rawPage.skipToken;
    } while (skipToken);

    console.log(`[dataProvider] Loaded ${raw.length} rows from Dataverse (across all pages)`);

    // 3) Map to AgentDetailRow format (camelCase)
    const rows: AgentDetailRow[] = raw.map(r => ({
      agentName: r.cat_agentname ?? null,
      agentId: r.cat_agentid ?? null,
      environmentName: r.cat_environmentname ?? null,
      environmentId: r.cat_environmentid ?? null,
      feature: r.cat_feature ?? null,
      tool: r.cat_tool ?? null,
      llmModel: r.cat_llmmodel ?? null,
      channel: r.cat_channel ?? null,
      knowledgeSources: r.cat_knowledgesources ?? null,
      users: r.cat_users ?? 0,
      billedCredit: r.cat_billedcredit ?? 0,
      nonBilledCredit: r.cat_nonbilledcredit ?? 0,
      reportDate: r.cat_reportdate ? new Date(r.cat_reportdate).toISOString().split('T')[0] : null,
      lookbackDays: r.cat_lookbackdays ?? 0
    }));

    return rows;
  } catch (error) {
    console.error('[dataProvider] Failed to load data from Dataverse:', error);
    throw new Error('Failed to load credit consumption data. Please check your connection and try again.');
  }
}

/**
 * Load metadata (for compatibility - not used in Code App version)
 */
export async function loadMeta(): Promise<SnapshotMeta | null> {
  try {
    const metaResult = await Cat_syncmetadatasService.getAll({
      select: ['cat_currentbatch'],
      top: 1
    });
    
    const currentBatch = (metaResult.data[0] as { cat_currentbatch?: string } | undefined)?.cat_currentbatch;
    
    // Return a minimal SnapshotMeta for compatibility
    return {
      currentBatch: currentBatch ?? 'unknown',
      generatedAt: new Date().toISOString(),
      totalRows: 0,
      byWindow: []
    };
  } catch {
    return null;
  }
}

/**
 * Load the latest tenant capacity snapshot (MCSMessages) from Dataverse.
 * Returns null when no capacity row exists yet.
 */
export async function loadTenantCapacity(capacityType = 'MCSMessages'): Promise<TenantCapacity | null> {
  try {
    const result = await Cat_tenantcapacitiesService.getAll({
      select: [
        'cat_capacitytype',
        'cat_unit',
        'cat_entitled',
        'cat_consumed',
        'cat_allocated',
        'cat_available',
        'cat_paygoconsumed',
        'cat_status',
        'cat_asofdate'
      ],
      filter: `cat_capacitytype eq '${capacityType}'`,
      orderBy: ['cat_asofdate desc'],
      top: 1
    });

    const row = result.data[0] as Cat_tenantcapacities | undefined;
    if (!row) return null;

    return {
      capacityType: row.cat_capacitytype ?? capacityType,
      unit: row.cat_unit ?? '',
      entitled: row.cat_entitled ?? 0,
      consumed: row.cat_consumed ?? 0,
      allocated: row.cat_allocated ?? 0,
      available: row.cat_available ?? 0,
      payGoConsumed: row.cat_paygoconsumed ?? 0,
      status: row.cat_status ?? null,
      asOfDate: row.cat_asofdate ? new Date(row.cat_asofdate).toISOString().split('T')[0] : null
    };
  } catch (error) {
    console.error('[dataProvider] Failed to load tenant capacity:', error);
    return null;
  }
}
