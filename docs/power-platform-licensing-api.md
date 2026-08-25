# Power Platform licensing API

Engineering reference for the API used by Copilot Credit Consumption V2.

| Item | Value |
|---|---|
| Service | Microsoft Power Platform API |
| Base URL | `https://api.powerplatform.com` |
| API version | `2024-10-01` |
| Entitlement | `MCSMessages` |
| Authentication audience | `https://api.powerplatform.com` |
| Integration | `solution-v2` |
| Last verified | 2026-08-24 |

`2024-10-01` is the latest stable Power Platform API version as of the last
verification date. Microsoft added the licensing entitlement operations to its public
REST reference in July 2026 without introducing a newer API version.

## Support boundary

The route, API version, required date parameters, paging parameters, and core response
models are documented by Microsoft. The current public resource schema describes a flat
`value[]` collection.

Our live tenant testing returned a richer envelope under `value[0].resources[]` when
`includeFields=users,tags,asOfDate` was supplied. That parameter and several rich metadata
properties are not fully described in the public REST reference. Treat them as an
empirically validated contract and regression-test them before changing the integration.

## Endpoints

### Tenant entitlement and capacity

```http
GET https://api.powerplatform.com/licensing/entitlements/MCSMessages?api-version=2024-10-01
```

Purpose: retrieves tenant-level Copilot Studio message-credit entitlement, consumption,
allocation, availability, overage status, and pay-as-you-go values.

The tenant is inferred from the bearer token. Do not add a tenant ID to the path.

Core fields consumed by V2:

```text
entitlement.unit
entitlement.capacity.entitled.value
entitlement.capacity.consumed.value
entitlement.capacity.consumed.lastUpdatedOn
entitlement.capacity.consumed.writeOff
entitlement.capacity.allocated.value
entitlement.capacity.availableQuantity
entitlement.capacity.status
entitlement.payGo.consumed.value
```

Example shape, with tenant values removed:

```json
{
  "entitlementId": "MCSMessages",
  "entitlement": {
    "unit": "Count",
    "capacity": {
      "entitled": { "value": 0 },
      "consumed": {
        "value": 0,
        "consumptionType": "MonthToDate",
        "lastUpdatedOn": "2026-08-23T00:00:00Z",
        "writeOff": 0
      },
      "allocated": { "value": 0, "autoAllocated": 0 },
      "availableQuantity": 0,
      "status": "WithinCapacity"
    },
    "payGo": {
      "consumed": { "value": 0 }
    }
  }
}
```

The flow uses `capacity.consumed.lastUpdatedOn` as the latest complete usage day. If it
is absent, it falls back to yesterday in UTC.

### Per-resource consumption

Documented request:

```http
GET https://api.powerplatform.com/licensing/entitlements/MCSMessages/resources?fromDate={yyyy-MM-dd}&toDate={yyyy-MM-dd}&pageSize={pageSize}&continuationToken={token}&api-version=2024-10-01
```

Request used by V2:

```http
GET https://api.powerplatform.com/licensing/entitlements/MCSMessages/resources?fromDate=2026-08-23&toDate=2026-08-23&includeFields=users%2Ctags%2CasOfDate&pageSize=5000&continuationtoken=&api-version=2024-10-01
```

V2 queries one UTC day at a time by setting `fromDate` and `toDate` to the same date.
This preserves daily grain and avoids ambiguous multi-day boundary behavior.

Live-observed response shape:

```json
{
  "value": [
    {
      "resources": [
        {
          "environmentId": "00000000-0000-0000-0000-000000000000",
          "resourceId": "agent-id",
          "consumed": 0,
          "unit": "Count",
          "asOfDate": "2026-08-23T00:00:00",
          "metadata": {
            "ResourceName": "Agent name",
            "NonBillableQuantity": 0,
            "Users": 0,
            "ChannelId": null,
            "KnowledgeSources": null,
            "ToolInvoked": null,
            "LLMModel": null,
            "FeatureName": null
          }
        }
      ]
    }
  ],
  "continuationtoken": ""
}
```

Metadata values are nullable. Consumers must not assume every row has model, channel,
feature, tool, or knowledge source values.

### Harness-specific metadata behavior

The detailed dimensions depend on the harness used to build the agent. Live observation
shows the following behavior:

- Agents built with the **Classic harness** can provide the rich feature, tool, LLM model,
  and knowledge source dimensions described above.
- Agents built with the **GitHub Copilot harness** report `metadata.FeatureName` as
  `Process Agent` for all consumption rows.
- For GitHub Copilot harness agents, `metadata.ToolInvoked`, `metadata.LLMModel`, and
  `metadata.KnowledgeSources` are not provided by the source API and are stored as blank
  values in Dataverse.

This is an upstream telemetry limitation, not a paging, mapping, or Dataverse write
failure. Dashboards and exports should not interpret those blank dimensions as missing
ingestion data.

### Environment lookup

The flow also calls the Power Platform environment API to map environment IDs to display
names:

```http
GET https://api.powerplatform.com/environmentmanagement/environments?api-version=2024-10-01
```

Failure of this lookup does not change the source consumption values; it can leave the
stored environment display name empty.

## Authentication and authorization

Use Microsoft Entra ID OAuth with this resource/audience:

```text
https://api.powerplatform.com
```

For the Power Automate **HTTP with Microsoft Entra ID** connection, enter that value in
both **Base Resource URL** and **Microsoft Entra ID resource URI**. V2 binds this
connection through `ccsync_bapref`.

Delegated authentication with a tenant-admin account has been tested successfully. The
current deployment guidance allows Global Administrator, Power Platform Administrator,
or Billing Administrator. The exact least-privilege permission set has not been
established.

Service-principal authentication has not been validated for these routes. Do not assume
that a client-credentials token which can call another Power Platform API can read tenant
licensing data.

## Paging and data integrity

- Request `pageSize=5000`. A tested 1,582-row day then remained on one stable source page.
- Read `continuationtoken` from each response and continue until it is empty.
- Retain cross-page de-duplication. It protects against duplicate rows but cannot recover
  rows omitted by shifting server-side page boundaries.
- Do not return to the API default page size without repeating page-stability tests.
- The flow's `Until` loop is capped at 1,000 iterations and one hour per day.

The current de-duplication fingerprint combines report date, agent, environment, rich
dimensions, billed and non-billed quantities, and user count. Distinct rows for the same
agent and day are expected when model, feature, tool, channel, or another dimension
differs.

## Dataverse mappings

| API field | Dataverse column |
|---|---|
| `resourceId` | `cat_agentid` |
| `metadata.ResourceName` | `cat_agentname` |
| `environmentId` | `cat_environmentid` |
| `consumed` | `cat_billedcredit` |
| `metadata.NonBillableQuantity` | `cat_nonbilledcredit` |
| `metadata.Users` | `cat_users` |
| `metadata.ChannelId` | `cat_channel` |
| `metadata.FeatureName` | `cat_feature` |
| `metadata.ToolInvoked` | `cat_tool` |
| `metadata.LLMModel` | `cat_llmmodel` |
| `metadata.KnowledgeSources` | `cat_knowledgesources` |
| Query date | `cat_reportdate` |

The source can return more than 1,000 rows for a day. V2 therefore writes filtered rows
to Dataverse in sequential 500-operation changesets. API page size and Dataverse write
chunk size are independent settings.

## Refresh behavior

- First successful load: fetch 180 complete days.
- Subsequent loads: replace a seven-day overlap to capture restatements.
- Grain: one API request per day and potentially multiple rows per agent per day.
- Retention: historical rows are retained indefinitely outside the refreshed overlap.
- Capacity: one tenant capacity snapshot is stored per flow run.

## Error interpretation

| Status | Likely cause | First check |
|---|---|---|
| `400` | Invalid date, query parameter, or continuation token | Compare the request with the exact V2 form above. |
| `401` | Missing, expired, or wrong-audience token | Confirm the audience is `https://api.powerplatform.com`. |
| `403` | Calling identity lacks tenant licensing access | Reauthorize with the approved tenant-admin identity. |
| `404` | Unknown entitlement or unsupported route | Confirm `MCSMessages`, route casing, and API version. |
| `429` | Service throttling | Honor retry guidance and avoid parallel daily source calls. |

Do not log bearer tokens or commit raw tenant responses. Resource payloads contain tenant
usage telemetry and agent identifiers and should be handled as internal operational data.

## Validation status

Completed:

- Capacity request succeeded with delegated authentication.
- Resource requests returned billed, non-billed, user, model, channel, feature, tool, and
  knowledge-source dimensions.
- Single-day requests retained daily grain.
- `pageSize=5000` was stable across repeated high-volume calls.
- V2 managed and unmanaged packages passed semantic validation and PAC unpacking.
- A clean unmanaged V2 import completed with the three required connection references
  bound and active.
- The 180-day first-load flow run succeeded and persisted 27,103 unique rows over 180
  continuous days with no duplicate fingerprints.
- Direct API comparisons matched the latest day and the 1,582-row peak-day exactly after
  normalizing credit values to the Dataverse columns' two-decimal precision.
- The stored capacity snapshot matched the response archived in the successful flow run.
- Post-run solution, flow, connection, table, Code App, role, sync-metadata, capacity, and
  source-parity validation passed all 88 checks with no warnings.

Remaining identity-specific validation:

- Validate service-principal authentication if the deployment will not use a delegated
  service account.

## Change checklist

Before changing the API version, route, parameters, or response parsing:

1. Check Microsoft's versioning page and monthly programmability changelog.
2. Run capacity and one-day resource calls with the intended deployment identity.
3. Save only a redacted field inventory; do not commit tenant payloads.
4. Compare the observed envelope and metadata keys with this document.
5. Repeat a high-volume page-stability test.
6. Rebuild and run `solution-v2/validate-v2.ps1` against both package types.
7. Import and run in a sandbox before approving production deployment.

## Microsoft references

- [Get Entitlement](https://learn.microsoft.com/rest/api/power-platform/licensing/entitlement/get-entitlement)
- [Get Tenant Resources Across Environments](https://learn.microsoft.com/rest/api/power-platform/licensing/entitlement-insight/get-tenant-resources-across-environments)
- [Power Platform API versioning and support](https://learn.microsoft.com/power-platform/admin/programmability-versioning-support)
- [Programmability changes for July 2026](https://learn.microsoft.com/power-platform/admin/programmability-whats-new-changed#july-2026)
- [Power Platform API authentication](https://learn.microsoft.com/power-platform/admin/programmability-authentication-v2)

## Local implementation

- `solution-v2/src/Workflows/CopilotCreditConsumptionEndToEnd-3C9D1E202B3C4D5E9F6A7B8C9D0E1F2A.json`
- `solution-v2/build-v2.ps1`
- `solution-v2/validate-v2.ps1`
- `solution-v2/README.md`