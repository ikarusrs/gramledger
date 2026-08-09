# GramLedger Data Source Audit

**Audit date:** 2026-08-01  
**Scope:** official public upstream sources referenced by `docs/PLANNING.md`  
**Change type:** documentation only; no API, feature, or schema changes

## Executive Summary

The planned architecture is **partially supported** by currently observable
official data.

- **Supported:** LGD-based administrative hierarchy, data.gov.in/Agmarknet
  daily market prices, and an IMD weather integration after authenticated API
  access is obtained.
- **Partially supported:** eGramSwaraj profiles and finance. Public static
  reports exist, but the accessible report contract is HTML and commonly
  requires CAPTCHA/session POST flows for panchayat-level detail. The stable
  public pages verified during this audit include state/district summary
  reports **and** the scheme-wise drill-down, whose "Village Wise Summary
  Report" pages expose per-gram-panchayat receipt/payment rows over plain GET
  links (`blockWiseSummaryReport.do` → `schemeWiseVillageReport.do`). Those rows
  are now ingested into `scheme_expenditures`.
- **Not established:** a reproducible, documented Meri Panchayat API for the
  governance data GramLedger needs. One public JSON endpoint was observed in
  the web application's JavaScript, but it is an application-internal JJM
  dashboard endpoint, not a documented data contract.
- **Unsupported without additional source access:** reliable panchayat-level
  grants, expenditures, scheme spending, works, and assets loaded into the
  current foreign-keyed schema.

The API should not be implemented as if all rows in eGramSwaraj reports can be
loaded into `panchayat_id` tables. That would turn district totals into false
panchayat facts.

## Evidence Standard

Each statement is labelled implicitly by its evidence:

- **Observed:** directly retrieved from an official page or endpoint during this
  audit.
- **Documented:** stated by the official source's own page or documentation.
- **Inference:** derived from observed response shape or application code and
  requires confirmation before production reliance.
- **Unknown:** not published or not reproducible without credentials,
  CAPTCHA, or a source-owner response.

The audit does not treat search results, third-party API wrappers, or scraped
claims as source documentation.

## Source Inventory

### 1. eGramSwaraj

Official portal: [egramswaraj.gov.in](https://egramswaraj.gov.in/)

| Property             | Finding                                                                                                                                                                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Access               | Public HTML pages are reachable without login. Profile and detailed report forms can require CAPTCHA and session state.                                                                                                                                            |
| Interface            | HTML `.do` pages, generated `FileRedirect.jsp` HTML reports, form POSTs, and client-side requests. No documented public API was found.                                                                                                                             |
| Verified pages       | `profilerReport.do`, `financialProgressReport.do`, `planningDashBoard.do`, `basicProfileConsolidateReport.do`, static expenditure and summary `FileRedirect.jsp` reports.                                                                                          |
| Update frequency     | Current/rolling financial-year reports; exact publication schedule is not documented. The portal displays a report-generated timestamp. Treat as daily/irregular, not guaranteed nightly.                                                                          |
| Geographic coverage  | National. Static reports observed at state and district levels. Profile/detail forms expose state, district, block, and Gram Panchayat selectors.                                                                                                                  |
| Panchayat support    | Public panchayat profile/detail forms exist, but automated access may require CAPTCHA and POST/session state. A stable, CAPTCHA-free panchayat export was not verified.                                                                                            |
| District support     | Yes. Maharashtra district expenditure and summary pages were directly observed.                                                                                                                                                                                    |
| Taluka/block support | Forms and planning reports expose block/panchayat tiers, but a stable public extract was not verified.                                                                                                                                                             |
| Village support      | Village Panchayat appears in report dimensions; a stable village-level public extract was not verified.                                                                                                                                                            |
| Licensing            | Portal Terms prohibit copying/reproduction/distribution without permission; the Copyright Policy requires permission where applicable and source acknowledgement. Project-specific authorization must be retained and does not establish a general public license. |
| Rate limits          | No public technical limit found. The project authorization supplied for this work specifies 10 requests/minute and off-peak execution; use that as the operational ceiling.                                                                                        |
| Pagination           | Some forms expose `page`/`pageSize`; generated reports are file/path based. No common pagination contract exists across report families.                                                                                                                           |
| Stable identifiers   | State and district report URLs contain codes. LGD codes are visible in the wider Panchayat Enterprise Suite ecosystem, but the relationship between every eGramSwaraj report code and LGD code must be verified per report.                                        |
| Fields observed      | Financial year, state/district, tier totals, receipts, payments, profile selectors, scheme names/codes, activity/work/asset labels.                                                                                                                                |
| Missing/uncertain    | Reliable panchayat LGD identifiers in all report rows, normalized scheme IDs, profile contacts without CAPTCHA, detailed works/assets without protected flows, change history, and a stable schema version.                                                        |
| Reliability          | Medium for static summary pages; low-to-medium for automated panchayat detail because HTML layout, generated filenames, CAPTCHA, and form flows can change.                                                                                                        |

#### eGramSwaraj-specific findings

**Do panchayat-level financial reports exist?** Yes. Beyond the planning
dashboard's panchayat-wise expenditure/activity reports (which sit behind
CAPTCHA/session state), the **scheme-wise expenditure** drill-down serves
per-GP rows publicly over plain GET links:

```text
FileRedirect.jsp?FD=SchemeWiseExpenditureReport2025-2026/3287&name=3287.html  (scheme state page)
  └─ .../3287//27&name=27.html                        (scheme district page)
       └─ blockWiseSummaryReport.do?param=generate&…  (block page)
            └─ schemeWiseVillageReport.do?…            (village page — one row per GP)
```

These pages were captured and the village page parsed into one scheme record per
gram panchayat (e.g. 147 GPs under scheme 3287 in Akole block, Maharashtra) with
fiscal-year `receipts`/`payments` and a denormalized scheme name (see
`docs/scraper.md`). The R&P family (village-wise and GP monthly statements)
already ingested into `financial_statements`.

**Are report URLs deterministic?** Partly. Static reports follow patterns such
as:

```text
FileRedirect.jsp?FD=ExpenditureReport2025-2026/27&name=27.html
FileRedirect.jsp?FD=ExpenditureReport2025-2026/27/446&name=446.html
FileRedirect.jsp?FD=SchemeWiseExpenditureReport2025-2026/3287&name=3287.html
```

The patterns are useful for known report families, but generated file existence,
scheme IDs, year availability, and deeper path segments are not guaranteed.

**Required parameters:** Static files require financial year and hierarchy/path
codes. Interactive reports require report-specific POST parameters such as
`fyear`, `stateCode`, tier codes, category/subcategory, and sometimes CAPTCHA.

**LGD usage:** LGD is the authoritative location-code system for the broader
Panchayat Enterprise Suite, and eGramSwaraj pages expose state/district codes.
An exact row-level equivalence must not be assumed until a sample for every
report family is compared with LGD.

**Can Panchayat IDs be derived?** A source code may be present in report links,
but the current evidence does not prove that every code is the LGD panchayat
code. A resolver should require an explicit code match and dead-letter unknown
rows; name-only matching is unsafe.

**Schema mapping:** District/state summary amounts can be retained as source
observations, but cannot be inserted into the current `grants` or
`expenditures` tables because those tables require `panchayat_id` and
`scheme_id`. Profile, work, and asset rows require the same identity resolution.

### 2. Meri Panchayat

Official application: [meripanchayat.gov.in](https://meripanchayat.gov.in/)

| Property               | Finding                                                                                                                                                                                            |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Access                 | Public Angular application shell. No login was required to load the shell.                                                                                                                         |
| Interface              | Client-side JavaScript; one public JSON endpoint was observed in the bundle: `https://egramswaraj.gov.in/meri_panchayat/api/jjmcm/ddws/dashboard/v1/states`.                                       |
| Reproducibility        | The states POST was reproducible with `{ "state_id": 0 }` and returned JSON. The related `get_wso_state_operator_summary` call was not reproducible in the same direct test and returned HTTP 404. |
| Data scope             | The observed endpoint is a JJM/WSO state-operator dashboard, not a general Panchayat finance/profile API.                                                                                          |
| Update frequency       | Not published.                                                                                                                                                                                     |
| Geography              | Observed state list; further geography is unknown.                                                                                                                                                 |
| Licensing              | No machine-readable data license or API terms were established during this audit. Do not assume the application's data is redistributable.                                                         |
| Rate limits/pagination | Not documented.                                                                                                                                                                                    |
| Stable identifiers     | `state_id` was observed; its semantics align with portal state codes but were not independently established as LGD in this application.                                                            |
| Reliability            | Low as a GramLedger primary source until the owner documents the API and grants automation permission. The Angular bundle is an implementation detail and can change without notice.               |

**Primary-source decision:** Meri Panchayat should **not** become a primary
GramLedger source now. It may be a discovery/reference source after official
API documentation, licensing, rate limits, and a reproducible public contract
are obtained. Do not reverse engineer or bypass authentication/security
controls.

### 3. data.gov.in / Open Government Data Platform India

Official portal: [data.gov.in](https://www.data.gov.in/)

| Property                                  | Finding                                                                                                                                                                                                    |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Access                                    | Public catalog; API access requires a user API key.                                                                                                                                                        |
| Interface                                 | REST API, with JSON/CSV and resource metadata.                                                                                                                                                             |
| Update frequency                          | Dataset-specific; resource metadata exposes created/updated timestamps.                                                                                                                                    |
| Geographic coverage                       | Dataset-specific. LGD resources cover national administrative geography; Agmarknet covers markets/districts/states.                                                                                        |
| Panchayat/district/taluka/village support | Depends on dataset. The platform is a distribution/catalog layer, not a guaranteed Panchayat schema.                                                                                                       |
| Licensing                                 | Official Terms state that the license is in each dataset's `license` metadata element. The portal links the Government Open Data License - India (GODL); third-party/copyrighted material can be excluded. |
| Rate limits                               | API keys and per-request caps are documented conceptually; a universal numeric limit was not found. Resource-specific caps and throttling must be measured per dataset/key.                                |
| Pagination                                | Resource APIs expose `limit` and `offset`; effective caps can vary.                                                                                                                                        |
| Stable identifiers                        | Resource IDs and dataset metadata are stable enough to pin in configuration; row identifiers are dataset-specific.                                                                                         |
| Reliability                               | High for published API resources, but portal maintenance, resource refreshes, field changes, and throttling remain operational risks.                                                                      |

The portal's own Terms disclaim completeness/accuracy and instruct users to
verify current information with the responsible department/source. That is a
data-quality requirement, not a reason to reject the platform.

### 4. Agmarknet

Official portal: [agmarknet.gov.in](https://agmarknet.gov.in/)  
Primary GramLedger route: the official data.gov.in resource
`9ef84268-d588-465a-a308-a864a43d0070`.

| Property                         | Finding                                                                                                                                                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Access                           | Public web application; data.gov.in API key required for the selected resource.                                                                                                                                    |
| Interface                        | Agmarknet site is a JavaScript application. The frontend references an official `api.agmarknet.gov.in/v1/` host, but its authentication/contract was not established. Use the pinned data.gov.in resource instead. |
| Update frequency                 | Current daily market-price resource; observed metadata has an updated timestamp and records carry arrival dates. Verify freshness on every run.                                                                    |
| Geography                        | State, district, market/mandi. No Panchayat/taluka/village dimension.                                                                                                                                              |
| Panchayat/taluka/village support | No.                                                                                                                                                                                                                |
| District support                 | Yes, as a reported text field; district-to-LGD resolution is an application concern.                                                                                                                               |
| Fields observed                  | State, district, market, commodity, variety, grade, arrival date, minimum price, maximum price, modal price. Prices are INR/quintal.                                                                               |
| Missing fields                   | No Panchayat, taluka, farmer, transaction, or reliable LGD market/district code in the observed resource.                                                                                                          |
| Licensing                        | Governed by the data.gov.in dataset license metadata/GODL where applicable; verify the resource metadata before redistribution.                                                                                    |
| Rate limits/pagination           | API key, `limit`, `offset`, and optional filters. Numeric rate limits are not universally published; throttling was observed with a shared sample key.                                                             |
| Stable identifiers               | Resource ID is stable; natural key must include district, market, commodity, variety, grade, and price date.                                                                                                       |
| Reliability                      | High for daily price observations, medium for names/coverage and update timing.                                                                                                                                    |

### 5. India Meteorological Department (IMD)

Official API portal: [api.imd.gov.in](https://api.imd.gov.in/)  
Official public weather site: [mausam.imd.gov.in](https://mausam.imd.gov.in/)

| Property                         | Finding                                                                                                                                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Access                           | The API management portal documents authenticated access and secure JWT usage. The portal displayed a notice that new registrations were temporarily on hold for a new API usage/pricing policy. |
| Interface                        | Official REST API gateway; public web pages and bulletins are separate interfaces. Root API access without authentication returned 401 during verification.                                      |
| Update frequency                 | Forecast/observation/warning cadence is product-specific. The public site displays current observation times and current forecasts; exact API SLAs were not found.                               |
| Geography                        | Nationwide; city/station, district, subdivision, warning, and forecast products vary by API.                                                                                                     |
| Panchayat/taluka/village support | Not established. Weather products are generally station/city/district/subdivision, not LGD Panchayat.                                                                                            |
| District support                 | Yes for district warning/forecast products.                                                                                                                                                      |
| Fields observed/documented       | Forecasts, observations, warnings, rainfall and weather bulletins; exact field contract requires API documentation/account access.                                                               |
| Licensing                        | Official API terms/pricing policy were not available without portal onboarding. Confirm before storing/redistributing.                                                                           |
| Rate limits/pagination           | Authenticated key controls are documented generally; numeric limits were not published in the accessible pages.                                                                                  |
| Stable identifiers               | Station/city/district identifiers are product-specific; LGD mapping is not guaranteed.                                                                                                           |
| Reliability                      | Source authority is high. Integration readiness is medium because access policy and onboarding are currently unsettled.                                                                          |

The existing plan's statement that IMD is a free API should be treated as stale
until the current policy, registration status, and pricing are confirmed.

### 6. Maharashtra Open Data

An independent Maharashtra open-data portal was not reproducibly verified during
this audit. Maharashtra datasets are discoverable through data.gov.in, but that
does not prove that a separate state portal has a stable API, license, or
availability contract.

| Property                                     | Finding                                                                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Access/interface                             | Unknown for an independent state portal; use data.gov.in catalog resources where the Maharashtra department has published them. |
| Geography                                    | Dataset-specific.                                                                                                               |
| Licensing/rate limits/pagination/identifiers | Must be read from each dataset record; no general state-wide contract verified.                                                 |
| Reliability                                  | Unknown until a concrete official dataset/resource is pinned.                                                                   |

### 7. Local Government Directory (LGD)

Official portal: [lgdirectory.gov.in](https://lgdirectory.gov.in/)

| Property                        | Finding                                                                                                                                                                                      |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Access                          | Public citizen pages; some options expose session/CSRF parameters.                                                                                                                           |
| Interface                       | HTML reports and downloads; no stable public REST API was verified.                                                                                                                          |
| Update frequency                | Maintained by states/UTs; live portal shows current counts and officer update dates. Not a fixed monthly feed.                                                                               |
| Geographic coverage             | State/UT, district, sub-district, development block, village, and rural/urban local bodies.                                                                                                  |
| Panchayat support               | Yes, including district, block, and village local bodies.                                                                                                                                    |
| District/taluka/village support | Yes. LGD calls the sub-district layer `Sub-District`; the application may label the business layer as taluka.                                                                                |
| Licensing                       | Government directory/public official data; a specific redistribution license was not identified. Preserve attribution and verify download terms.                                             |
| Rate limits/pagination          | Not documented; citizen reports may require session tokens.                                                                                                                                  |
| Stable identifiers              | LGD codes are the authoritative intended interoperability identifier. The portal explicitly describes unique codes for states, districts, sub-districts, villages, blocks, and local bodies. |
| Reliability                     | High as the canonical hierarchy, with state-maintained freshness and known exceptions/mappings requiring reconciliation.                                                                     |

LGD is the strongest source for the hierarchy and should be the identity
authority for all other sources. Names must not be used as the primary key.

### 8. Other official sources named in PLANNING.md

PLANNING.md also references official Kisan/ICAR content, Bhashini, and curated
government scheme documents. These are **content inputs**, not currently defined
ETL feeds:

- **Schemes:** the current plan explicitly allows a manual curated catalog plus
  official documents. No single stable scheme registry contract was verified;
  do not promise automated completeness.
- **Kisan/ICAR FAQ and agronomy content:** suitable for curated RAG ingestion
  after document-by-document licensing and citation review; no fixed API was
  established.
- **Bhashini/Google speech services:** application services, not source datasets;
  API keys, quotas, and terms must be audited separately before implementation.
- **Soil/agro-climatic data:** the plan names district soil/agro-climatic inputs
  but does not pin an official dataset/resource. Village-level soil advice is
  therefore not source-backed today.

## Data Coverage Matrix

Legend: **Yes** = directly verified; **Partial** = exists for some products or
requires credentials/flow-specific work; **No** = not found; **Unknown** = not
verified.

| Source                |            State |         District |          Taluka/sub-district |          Village | Panchayat/local body |          Finance |     Works/assets |    Market prices |          Weather |
| --------------------- | ---------------: | ---------------: | ---------------------------: | ---------------: | -------------------: | ---------------: | ---------------: | ---------------: | ---------------: |
| eGramSwaraj           |              Yes |              Yes |                      Partial |          Partial |              Partial |          Partial |          Partial |               No |               No |
| Meri Panchayat        |          Partial |          Unknown |                      Unknown |          Unknown |              Unknown |          Unknown |          Unknown |               No |               No |
| data.gov.in           | Dataset-specific | Dataset-specific |             Dataset-specific | Dataset-specific |     Dataset-specific | Dataset-specific | Dataset-specific | Yes via resource | Dataset-specific |
| Agmarknet             |              Yes |              Yes |                           No |               No |                   No |               No |               No |              Yes |               No |
| IMD                   |              Yes |              Yes | Subdivision/product-specific |               No |                   No |               No |               No |               No |              Yes |
| Maharashtra Open Data |          Unknown |          Unknown |                      Unknown |          Unknown |              Unknown |          Unknown |          Unknown |               No |          Unknown |
| LGD                   |              Yes |              Yes |                          Yes |              Yes |                  Yes |               No |               No |               No |               No |

## Feature Coverage Matrix

| Planned feature                         | Status                                 | Evidence and constraint                                                                                                        |
| --------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Panchayat search                        | **Partially supported**                | LGD can provide authoritative names/codes; eGramSwaraj is not yet verified as a complete panchayat export.                     |
| District -> taluka -> village hierarchy | **Fully supported**                    | LGD explicitly covers these layers and codes. Requires reconciliation of exceptions and current downloads.                     |
| Panchayat profiles                      | **Partially supported**                | eGramSwaraj exposes profile reports/forms; stable CAPTCHA-free bulk extraction and field completeness are unverified.          |
| Grants                                  | **Unsupported at planned granularity** | Existing table requires panchayat and scheme IDs; observed public eGram reports are summaries or protected detail flows.       |
| Expenditure                             | **Partially supported**                | District/state summaries are public; panchayat-level normalized rows are not reliably extractable under the verified contract. |
| Scheme-wise spending                    | **Partially supported**                | Scheme-wise drill-down pages expose per-GP receipt/payment rows over public GET links and are ingested into `scheme_expenditures`; the scheme NAME is stored denormalized because source-specific scheme identity/codes are unresolved. |
| Financial charts                        | **Partially supported**                | Charts can use verified district/state aggregates, not the planned complete panchayat data.                                    |
| Financial trends                        | **Partially supported**                | Multiple financial-year static reports exist, but availability and schema consistency vary by report/year.                     |
| Panchayat comparison                    | **Unsupported as planned**             | Requires comparable panchayat-level finance with stable identity and complete coverage.                                        |
| Public works                            | **Partially supported**                | Planning/activity reports exist, but detailed panchayat records are client-side/CAPTCHA/session dependent.                     |
| Assets                                  | **Partially supported**                | Asset report/dashboard pages exist; completeness, stable IDs, and automated panchayat detail were not verified.                |
| Government schemes                      | **Partially supported**                | A curated catalog is feasible; automated authoritative completeness is not established.                                        |
| Download/share reports                  | **Partially supported**                | Possible for data GramLedger legally stores; source licenses/permission and missing panchayat coverage constrain it.           |
| Offline cache                           | **Fully supported technically**        | Feasibility depends on the subset of data that can be legally and reliably ingested.                                           |
| Grant notifications                     | **Unsupported currently**              | Requires reliable panchayat-level deltas and source freshness.                                                                 |
| Spending anomaly detection              | **Partially supported**                | District/state aggregates permit aggregate analysis; planned peer Panchayat z-scores require panchayat-level finance.          |
| Marathi chatbot/RAG                     | **Partially supported**                | Official curated documents can be indexed after source-by-source licensing; live governance coverage is incomplete.            |
| Soil advice                             | **Unsupported at village level**       | Plan itself notes village-level soil data is scarce; no pinned official feed was found.                                        |
| Weather-aware advice                    | **Partially supported**                | IMD provides relevant products, but current authenticated API onboarding/policy is a blocker.                                  |
| Market prices                           | **Fully supported**                    | Agmarknet data.gov.in resource provides daily state/district/market prices with a stable resource ID and API pagination.       |
| Crop recommendation                     | **Partially supported**                | Market/weather inputs exist; soil/agro-climatic source and coverage are not yet pinned.                                        |
| Scheme recommendation                   | **Partially supported**                | Location hierarchy and a manual scheme catalog are feasible; authoritative grant eligibility completeness needs source review. |

## Identifier Mapping

| Entity               | Preferred identifier                     | Current risk                                                                                                     |
| -------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| State                | LGD state code                           | Other sources may expose portal-specific state codes; maintain an explicit crosswalk.                            |
| District             | LGD district code                        | Agmarknet and eGramSwaraj often expose names or portal codes; never join by name alone.                          |
| Taluka/sub-district  | LGD sub-district code                    | Current schema calls the table `talukas`; preserve source code and source type.                                  |
| Block Panchayat      | LGD local-body code plus level           | A block/development-block code is not automatically a Panchayat Samiti/local-body code.                          |
| Village              | LGD village code                         | Village-to-Panchayat mappings can be many-to-one or temporarily incomplete; LGD publishes exception reports.     |
| Panchayat            | LGD local-body code                      | Do not infer this from an eGram URL segment until cross-checked against LGD.                                     |
| Scheme               | Source scheme code plus source namespace | `scheme_id` is an internal surrogate; the current schema lacks a source-system/code namespace column.            |
| Market               | No stable ID verified                    | Agmarknet resource supplies text market names; natural key must include normalized location and date dimensions. |
| Weather station/city | IMD product-specific ID                  | No universal LGD-to-station mapping was verified.                                                                |

## Schema Validation

### Correct assumptions

- LGD-coded hierarchy tables and unique LGD constraints are directionally
  correct.
- Governance tables correctly require relationships rather than accepting
  anonymous money rows.
- `commodity_prices` has a district-aware natural key and should remain
  separate from Panchayat finance.
- `ingestion_runs` supports source-level audit, but not source endpoint/resource
  versioning.

### Incorrect or unproven assumptions

- The plan assumes eGramSwaraj can populate every panchayat-keyed governance
  table nightly. This is not verified.
- `panchayats.taluka_id NOT NULL` assumes every Panchayat maps cleanly to the
  chosen taluka/sub-district layer. LGD exceptions and block/local-body
  distinctions need explicit reconciliation.
- `grants.scheme_id` and `expenditures.scheme_id` assume all source schemes can
  be resolved to the internal catalog. Source namespaces and versioning are not
  represented.
- `public_works` and `assets` lack explicit source IDs and source timestamps,
  which weakens incremental updates and provenance.
- `assets` has no natural key, so idempotent imports cannot be guaranteed.
- `public_works` has no unique natural key despite the ETL plan requiring
  idempotent upserts.
- `panchayat_profiles` has no source record identifier or source URL and only
  one current row, so historical profile changes cannot be audited.
- `commodity_prices` stores no source resource ID or observed/source timestamp;
  `price_date` is not the same as ingestion freshness.

### Justified future schema changes

Do not make these changes before the source contracts are confirmed. If the
contracts become available, the minimum justified changes are:

1. Add provenance columns to source-backed tables: `source`, `source_url`,
   `source_record_id`, `observed_at`, and optionally `raw_snapshot_key`.
2. Add source namespaces/codes to `schemes` and a unique constraint such as
   `(source, source_code)`.
3. Add source natural keys to `public_works` and `assets` after observing their
   official identifiers; do not invent a key from a mutable title alone.
4. Add a mapping table for source location codes to LGD codes where portal codes
   differ.
5. Consider a separate summary table only if district/state reports are an
   intentional product requirement. Do not force summaries into panchayat rows.

These are recommendations, not migrations. No schema was changed by this
audit.

## Known Limitations

- No universal official source provides all planned Panchayat profile, finance,
  works, asset, and scheme data in a stable machine-readable contract.
- Public availability does not imply redistribution rights; verify each source's
  license and retain the authorization/attribution record.
- Source freshness is product-specific. `ingestion_runs` should record endpoint,
  financial year, resource ID, and source timestamps, not only row counts.
- Names are not reliable identifiers across eGramSwaraj, LGD, Agmarknet, Meri
  Panchayat, and IMD.
- A failed endpoint can look like an empty report. Parsers need minimum-row,
  header, and freshness checks before treating an empty result as valid.
- The current eGramSwaraj implementation loads resolved rows into
  `financial_statements` and `scheme_expenditures`; it intentionally avoids
  `grants`, `expenditures`, `public_works`, and `assets` because this audit has
  not established a safe scheme/works/asset identity mapping contract.

## Recommended Implementation Order

1. **LGD hierarchy:** acquire and pin an official current download/report,
   reconcile state/district/sub-district/block/village/local-body mappings, and
   establish LGD as the identity authority.
2. **Agmarknet via data.gov.in:** retain the existing daily price pipeline;
   record resource metadata, source freshness, API key health, and throttling.
3. **IMD access confirmation:** obtain an API account, document JWT/key policy,
   test district products, and map stations/products before weather features.
4. **eGramSwaraj access agreement:** obtain a durable approved panchayat-level
   export/API or a documented CAPTCHA-free batch contract. Then implement
   resolvers and loaders against fixtures first.
5. **Meri Panchayat decision:** request official API documentation and license
   information. Do not make it primary unless it provides a durable, permitted
   contract unavailable from eGramSwaraj/LGD.
6. **Schema hardening:** add provenance and source identifiers only after the
   preceding contracts produce real sample rows.
7. **API implementation:** begin only after hierarchy, market prices, weather
   access, and the supported subset of governance data have explicit coverage
   and freshness guarantees.

## Highest-Risk Dependencies

1. **eGramSwaraj panchayat-level extraction:** CAPTCHA/session flows, generated
   URLs, HTML drift, and missing proven LGD mappings.
2. **Meri Panchayat contract:** public application internals are not an API
   guarantee, and licensing/rate limits are unknown.
3. **IMD API onboarding:** current official portal says new registrations are
   temporarily on hold pending an API usage/pricing policy.
4. **LGD freshness and crosswalks:** the hierarchy is authoritative, but source
   mappings and exception reports must be reconciled continuously.
5. **Scheme identity:** internal scheme foreign keys cannot safely resolve
   source-specific scheme codes without a source namespace and version policy.
6. **Provenance and incremental updates:** current governance tables lack enough
   source identifiers/timestamps to prove what changed or to safely reprocess a
   report.

## Official References Checked

- [eGramSwaraj home](https://egramswaraj.gov.in/)
- [eGramSwaraj profile reports](https://egramswaraj.gov.in/profilerReport.do)
- [eGramSwaraj planning dashboard](https://egramswaraj.gov.in/planningDashBoard.do)
- [eGramSwaraj financial progress](https://egramswaraj.gov.in/financialProgressReport.do)
- [Meri Panchayat](https://meripanchayat.gov.in/)
- [data.gov.in Terms of Use](https://www.data.gov.in/terms-of-use)
- [Government Open Data License - India](https://www.data.gov.in/Godl)
- [data.gov.in APIs](https://www.data.gov.in/apis)
- [Agmarknet](https://agmarknet.gov.in/)
- [Agmarknet data.gov.in resource](https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070)
- [IMD API Management](https://api.imd.gov.in/)
- [IMD public weather site](https://mausam.imd.gov.in/)
- [LGD](https://lgdirectory.gov.in/)
