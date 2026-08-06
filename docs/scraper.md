# eGramSwaraj Scraper

How the `egramswaraj` ETL source works: a polite, bounded crawler that ingests
panchayat-level financial data from the public eGramSwaraj portal
(`https://egramswaraj.gov.in/`) into the `financial_statements` table.

Scraping is done with **written permission** from the data owner. The crawler is
polite by default (rate-limited, transparent User-Agent with a contact email,
bounded page count) and only reads public, session-free HTML report pages.

## What it ingests

The **"Receipt and Payment"** report family, which is the only panchayat-level
data eGramSwaraj exposes through clean `FileRedirect.jsp` HTML links:

- **GP monthly statement** (`egramswaraj_monthly`) — one row per fiscal month
  (April → March) plus opening balance and totals, for a single gram panchayat.
- **Village-wise statement** (`egramswaraj_village`) — one row per gram
  panchayat with the fiscal-year totals, from a block's "Village wise Receipt
  and Payment Statement" page.

Report types that sit behind POST/CAPTCHA/session flows (scheme-wise
expenditure, public works, assets, panchayat profiles) are **not** automated.

## Site structure

The portal generates static drill-down pages:

```
state  (District wise)   FileRedirect.jsp?FD=ExpenditureReport2025-2026/27&name=27.html
  └─ district (Block wise)   .../27/424&name=424.html
       └─ block (Village wise)   .../27/424&name=4635.html
            └─ GP (Month Wise Payment and Receipt Statement)   FD=ExpFY2025-2026/27&name=167557.html
```

Notes:

- Files are generated per financial year and are periodically regenerated; an
  index page can transiently serve a session-expired/"File does not exist" page
  (HTTP 200). The crawler detects this and reports a **warning** for that page
  instead of silently loading nothing.
- State/district "aggregate" pages carry no panchayat rows and are skipped with
  a `skipped` diagnostic; only the block and GP pages produce records.

## Architecture

| File | Responsibility |
| --- | --- |
| `config.ts` | Env-driven config; requires `ETL_EGS_CONTACT_EMAIL`. |
| `client.ts` | BFS crawl (state → district → block → GP). Rate-limits, reuses the session cookie, bounds by `maxPages`, skips broken pages as warnings, propagates retryable failures. |
| `html.ts` | `node-html-parser`-based, rowspan/colspan-aware table extraction; `detectLevel` classifies pages. |
| `parser.ts` | Classifies pages by level and maps table rows to typed `EGramRecord`s; emits diagnostics when financial years, report types, or data rows vanish. |
| `resolver.ts` | Name-based identity resolution: scraped district/block/panchayat names → LGD ids via the `districts`/`talukas`/`panchayats` tables. |
| `stages.ts` | `validate` (fy/period/panchayat name/money), `normalize` (names + 2-decimal amounts), `deduplicate` (natural key), `createResolvingTransform` (drops records with no panchayat match). |
| `index.ts` | Wires stages into `createPipeline`; `runEGramSwaraj` entry point; upsert loader into `financial_statements`. |

Pipeline flow: `fetch → parse → validate → normalize → deduplicate → transform
(resolve) → load → report`. Unresolved or invalid records dead-letter; load
failures mark the run `partial`.

## Data model

`EGramRecord` → `financial_statements`, natural key
`(panchayat_id, fy, period, source)`:

| Column | Meaning |
| --- | --- |
| `panchayat_id` | Resolved LGD panchayat id (name-based). |
| `fy` | Fiscal start year (e.g. 2025). |
| `period` | `opening_balance`, `April 2025` … `March 2026`, or `total`. |
| `month_no` | April = 1 … March = 12 for monthly rows. |
| `receipts` / `receipt_cancellation` / `ob_cancellation` / `payments` / `payment_cancellation` | Rupee amounts from the statement table. |
| `opening_balance` | Opening balance for the month (monthly statement). |
| `source` | `egramswaraj_monthly` or `egramswaraj_village`. |

Amounts are stored as `numeric(18,2)`; money strings use Indian formatting
(`1,23,45,678.90`).

## Identity resolution

Scraped pages only carry **names** (`District:-Ahilyanagar,Block Panchayat &
Equivalent:-Akole,Village Panchayat & Equivalent:-Ambitkhind`), not LGD codes.
`resolver.ts` joins by exact name to `districts` → `talukas` → `panchayats`
(cached per run). **The LGD hierarchy must be populated first** (run the LGD
ETL / seed). Unmatched panchayats are dead-lettered and counted, not silently
dropped.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `ETL_EGS_CONTACT_EMAIL` | required | Identifying contact in the User-Agent. |
| `ETL_EGS_BASE_URL` | `https://egramswaraj.gov.in/` | Portal base URL. |
| `ETL_EGS_REPORT_URLS` | Maharashtra 2025-26 expenditure | Comma-separated seed report paths. |
| `ETL_EGS_MIN_INTERVAL_MS` | `6000` | Max 10 requests/minute. |
| `ETL_EGS_TIMEOUT_MS` | `30000` | Per-request timeout. |
| `ETL_EGS_MAX_PAGES` | `20` | Crawl page budget. |

## Running

```ts
import { runEGramSwaraj, loadEGramSwarajConfig } from '@gramledger/etl/sources/egramswaraj';

// Seed with a district report URL for a bounded pilot.
const sourceConfig = loadEGramSwarajConfig({
  ETL_EGS_REPORT_URLS: 'FileRedirect.jsp?FD=ExpenditureReport2025-2026/27/424&name=424.html',
  ETL_EGS_MAX_PAGES: '500',
});
const result = await runEGramSwaraj(config, sourceConfig, pool);
```

For a full-state run, seed with the state page; the crawler follows the
drill-down automatically. Monitor the returned run report for `skipped`/warning
diagnostics and dead-lettered records.

## Testing

- `etl/tests/egramswaraj.test.ts` — config, HTML helpers, parser, stages,
  resolver (fake pool), crawler, and end-to-end pipeline against captured
  fixtures in `etl/tests/fixtures/egramswaraj/`.
- Fixtures are **real pages** captured from the live site (state, district,
  block, GP monthly statement).
- A live smoke test was run against `egramswaraj.gov.in` (bounded, ~10
  requests): a block seed parsed 147 village statements and a GP seed parsed
  its 14 monthly rows.

## Drift and maintenance

Parser warnings surface through the run report. When one appears:

1. Save the source HTML and URL with the run timestamp.
2. Compare table headers and report links with the fixture set.
3. Update the parser only after confirming the new public report shape.
4. Add a fixture regression test before changing configured report URLs.

Attribution to eGramSwaraj and the Ministry of Panchayati Raj is required for
any permitted downstream publication. The source does not bypass CAPTCHA,
authentication, or throttling controls.
