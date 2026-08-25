# Copilot Credit Consumption V2

V2 migrates capacity and detailed Copilot credit consumption from
`licensing.powerplatform.microsoft.com` to the Power Platform API at
`api.powerplatform.com`. It keeps the existing solution identity, Dataverse schema,
Code App, workflow ID, daily grain, and rich metadata mappings.

See the [internal API reference](../docs/power-platform-licensing-api.md) for the
endpoint contract, observed payload, paging behavior, authentication, and validation
status.

## Changes from V1

- Uses `GET /licensing/entitlements/MCSMessages` for tenant capacity.
- Uses `GET /licensing/entitlements/MCSMessages/resources` for daily agent detail.
- Preserves `LLMModel`, `ChannelId`, `FeatureName`, `ToolInvoked`, `KnowledgeSources`,
  `Users`, `ResourceName`, and `NonBillableQuantity` mappings when supplied by the API.
- GitHub Copilot harness agents currently report feature `Process Agent` and do not
  provide tool, LLM model, or knowledge source values. This source limitation does not
  apply in the same way to Classic harness agents.
- Requests source pages of 5,000 rows. Continuation paging and cross-page deduplication
  remain enabled for larger days.
- Writes each source page to Dataverse as sequential 500-operation changesets, below the
  1,000-operation Dataverse `$batch` limit.
- Reuses `ccsync_bapref` for environment, capacity, and consumption requests. The legacy
  `ccsync_webref` connection is no longer used.
- Sets solution version `2.0.0.0` while retaining unique name
  `CopilotCreditConsumption`, so V2 upgrades V1 rather than installing a second copy.

## Packages

Generated files are under `solution-v2/dist/` and are intentionally gitignored:

| Package | Purpose |
|---|---|
| `CopilotCreditConsumption_v2_managed.zip` | Full managed install or managed V1 upgrade. |
| `CopilotCreditConsumption_v2.zip` | Full unmanaged install or unmanaged V1 upgrade. |
| `CopilotCreditConsumption_2_0_0_0.zip` | Flow-only development package. |

The full packages preserve the V1 tables, security role, and Code App assets. Use the
package type that matches the existing installation.

GitHub Releases publish these packages under the stable download names
`CopilotCreditConsumption.zip` and `CopilotCreditConsumption_managed.zip`.

## Connections

Clean V2 installations require three connections:

| Connection reference | Connector | Resource URI |
|---|---|---|
| `ccsync_bapref` | HTTP with Microsoft Entra ID | `https://api.powerplatform.com` |
| `ccsync_dvhttpref` | HTTP with Microsoft Entra ID | Target Dataverse org URL |
| `ccsync_dvref` | Microsoft Dataverse | Sign in to the target environment |

The Power Platform API connection was validated with delegated tenant-admin access. A
service principal has not yet been validated against the new licensing routes.

## Build

Build the flow-only package from the tracked V1 flow source:

```powershell
pwsh ./solution-v2/build-v2.ps1
```

To build full packages, provide the managed and unmanaged V1 release packages:

```powershell
pwsh ./solution-v2/build-full-v2.ps1 `
  -BaseUnmanagedPackage C:\path\to\CopilotCreditConsumption.zip `
  -BaseManagedPackage C:\path\to\CopilotCreditConsumption_managed.zip
```

Validate the generated packages and confirm that the Code App assets were preserved:

```powershell
pwsh ./solution-v2/validate-v2.ps1 `
  -BaseUnmanagedPackage C:\path\to\CopilotCreditConsumption.zip `
  -BaseManagedPackage C:\path\to\CopilotCreditConsumption_managed.zip
```

## Upgrade

1. Import the V2 package matching the installed package type.
2. Confirm `ccsync_bapref`, `ccsync_dvhttpref`, and `ccsync_dvref` are bound.
3. Turn the daily flow back on if import deactivates it.
4. Run it once and verify `cat_syncmetadata` reports
   `Agent sync OK (Power Platform API V2, 7-day overlap)`.
5. Compare the refreshed seven-day overlap and capacity snapshot before removing the old
   licensing connection.

An unmanaged upgrade can leave the now-unused `ccsync_webref` component in the target
environment because unmanaged imports do not delete absent components. It is harmless and
can be removed after a successful V2 run.

## Validation status

- Live delegated API calls confirmed capacity and rich resource payload compatibility.
- A 1,582-row high-volume day was stable in one 5,000-row source page across repeats.
- Managed and unmanaged packages pass local semantic validation.
- Both full packages unpack successfully with PAC CLI and preserve V1 Code App assets
  byte-for-byte.
- A clean unmanaged V2 import completed successfully with all three connection references
  supplied at import time. The solution contained exactly the expected three tables,
  three connection references, security role, flow, and Code App.
- The 180-day first-load run completed successfully across 180 continuous days. Post-run
  validation passed all 88 checks: 27,103 unique detail rows, no duplicate fingerprints,
  exact latest-day and 1,582-row peak-day source parity at Dataverse credit precision,
  and an exact capacity-snapshot match to the archived run response.
- The imported flow is started with single-run concurrency, the Code App is published and
  `Ready`, and the reader role has organization-level read access to all three tables.
- Delegated tenant-admin access is validated; service-principal access remains unverified.
