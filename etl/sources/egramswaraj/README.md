# eGramSwaraj Source

This module implements the permitted, public-report portion of the eGramSwaraj
integration. It is deliberately isolated from the database loader because the
currently accessible public summary pages are state/district-level reports,
while GramLedger's normalized governance tables require `panchayat_id` foreign
keys.

## Scope

The source currently supports static HTML report pages such as:

- `FileRedirect.jsp?FD=ExpenditureReportYYYY-YYYY/27&name=27.html`
- `FileRedirect.jsp?FD=SummaryReportYYYY-YYYY/27&name=27.html`
- scheme-wise expenditure pages: `FileRedirect.jsp?FD=SchemeWiseExpenditureReport…
  &name=….html` (state/district) → `blockWiseSummaryReport.do` (block) →
  `schemeWiseVillageReport.do` (per-GP village leaf), all plain-GET, no session
  or CAPTCHA.

Interactive profile, activity, works, asset, and detailed panchayat reports are
not automated. They use CAPTCHA/session POST flows or client-side requests, and
there is no approved panchayat-level export in the repository's current data
contract.

## Architecture

- `config.ts` loads report URLs and requires a contact email for identification.
- `client.ts` keeps a lightweight session cookie, applies a 6-second default
  interval, sets a transparent User-Agent, enforces request timeouts, and caps
  pages.
- `html.ts` parses tables by rows/cells rather than brittle CSS chains. Header
  text is normalized and links are ignored when extracting cell values.
- `parser.ts` classifies report text and maps static report rows to typed records.
  Scheme-village pages yield one `scheme_village` record per GP row; aggregate
  scheme levels are skipped with a diagnostic. It emits diagnostics when
  financial years, report types, or data rows vanish.
- `stages.ts` validates fiscal years and amounts, normalizes names/money, and
  deduplicates natural keys. The transformer retains only records with a future
  panchayat identity so summary rows cannot be misloaded as panchayat data.
- `index.ts` wires the stages into `createPipeline` and routes records to their
  loader: R&P rows → `financial_statements`, scheme rows → `scheme_expenditures`
  (`panchayat_id`, `fy`, `scheme` natural key; scheme names are stored
  denormalized because source-specific scheme identity is unresolved — see
  `docs/DATA_SOURCE_AUDIT.md`).

## Configuration

| Variable                  | Default                                     | Purpose                               |
| ------------------------- | ------------------------------------------- | ------------------------------------- |
| `ETL_EGS_CONTACT_EMAIL`   | required                                    | Identifying contact in User-Agent     |
| `ETL_EGS_BASE_URL`        | `https://egramswaraj.gov.in/`               | Public portal base URL                |
| `ETL_EGS_REPORT_URLS`     | Maharashtra 2025-26 expenditure and summary | Comma-separated public report paths   |
| `ETL_EGS_MIN_INTERVAL_MS` | `6000`                                      | Maximum 10 requests/minute by default |
| `ETL_EGS_TIMEOUT_MS`      | `30000`                                     | Per-request timeout                   |
| `ETL_EGS_MAX_PAGES`       | `20`                                        | Maximum configured report requests    |

## Deferred loader decision

R&P records load into `financial_statements`; scheme per-GP rows load into
`scheme_expenditures`. Loading district totals into `expenditures`, `grants`,
`public_works`, or `assets` would violate their required `panchayat_id`
relationships and produce false data — the parser skips aggregate levels instead.
Scheme names are stored as published (denormalized); mapping them to the curated
`schemes` catalog is deferred until source-specific scheme identity is resolved
(see `docs/DATA_SOURCE_AUDIT.md`).

## Drift and maintenance

Parser warnings are emitted through the stage logger and metrics. Fixture tests
cover reordered columns, added columns, missing fields, duplicate rows, and
unrecognized pages. When a warning appears in production:

1. Save the source HTML and URL with the run timestamp.
2. Compare table headers and report links with the fixture set.
3. Update the parser only after confirming the new public report shape.
4. Add a fixture regression test before changing the configured report URLs.

The source does not bypass CAPTCHA, authentication, or throttling controls.
Attribution to eGramSwaraj and the Ministry of Panchayati Raj is required for
any permitted downstream publication.
