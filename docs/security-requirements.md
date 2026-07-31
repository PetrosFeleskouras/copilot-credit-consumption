# Security requirements — Copilot Credit Consumption

Three personas, each with different needs. The identity that **installs** the solution
isn't necessarily the one that **runs the sync**, and neither needs to be a **viewer**.

The solution contains 3 Dataverse tables (`cat_agentdetail`, `cat_tenantcapacity`,
`cat_syncmetadata`), the `Credit Insights Reader` role, the *Copilot Credit Consumption -
Daily* flow, and the *Copilot Credit Insights* Code App.

## 1. Install the solution

- **System Administrator** on the target Dataverse environment. System Customizer is **not**
  enough — the package creates a security role, which requires admin rights. (An Environment
  Admin works, since it holds System Administrator.)

## 2. Run the daily sync

The identity that **owns the flow's connections** needs **both** of the following — use a
dedicated **service account or service principal**, not a named user:

- **Tenant admin** — **Power Platform**, **Global**, or **Billing Administrator** — to read
  the licensing/entitlements API (`licensing.powerplatform.microsoft.com`) and the BAP
  environments API (`api.powerplatform.com`). Without it, both return **403**.
- **Dataverse write** — System Administrator, or Create/Write/Delete/Append on
  `cat_agentdetail`, `cat_tenantcapacity`, `cat_syncmetadata` (the flow does `$batch`
  inserts and deletes — read-only is not enough).

The four connections to authorize: `ccsync_webref` (licensing), `ccsync_bapref` (BAP),
`ccsync_dvhttpref` (Dataverse `$batch`), `ccsync_dvref` (Dataverse).

> Install rights and API access are independent — an Environment Admin can install the
> solution but still gets **403** from the source APIs without a tenant admin role.

## 3. View the app

- The **Code App shared** with the user (Power Apps → Apps → *Copilot Credit Insights* →
  Share) **and** the **`Credit Insights Reader`** role (ships in the solution).
- That role grants **Organization-level Read** on the three tables — required because all
  rows are owned by the sync account; without it the app loads but shows "No data." No admin
  or write rights are needed to view.
