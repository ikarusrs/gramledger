# data.gov.in — Agmarknet daily mandi prices

The first real source built on the ETL framework (the `example` source is a
stub). It ingests the **Current Daily Price of Various Commodities from Various
Markets (Mandi)** dataset — Agmarknet wholesale prices via the official
data.gov.in API — into the `commodity_prices` table.

- Pipeline source name: `data_gov_in` (matches the `ingestion_runs` CHECK)
- Data license: [Government Open Data License – India](https://data.gov.in/government-open-data-license-india)

## Module layout

```
sources/data_gov_in/
├── config.ts     env → DataGovInConfig (ETL_DGI_*)
├── client.ts     paginated API client + fetch stage (retryable errors)
├── mapping.ts    raw API record → internal record; parse/normalize/deduplicate
├── validate.ts   syntactic checks + district resolution (dead-letter rejects)
├── resolver.ts   district name_en → lgd_code lookup (single batched query)
├── index.ts      pipeline wiring (createPipeline + createUpsertLoader)
└── README.md     this file
```

## Configuration

| Variable              | Default                                | Notes                                  |
| --------------------- | -------------------------------------- | -------------------------------------- |
| `ETL_DGI_API_KEY`     | _(required)_                           | Free key from data.gov.in › My Account |
| `ETL_DGI_RESOURCE_ID` | `9ef84268-d588-465a-a308-a864a43d0070` | Agmarknet daily mandi prices dataset   |
| `ETL_DGI_STATE`       | _(unset = all India)_                  | Exact state name, e.g. `Maharashtra`   |
| `ETL_DGI_BASE_URL`    | `https://api.data.gov.in/resource`     | Overridable for tests/proxies          |
| `ETL_DGI_PAGE_SIZE`   | `1000`                                 | Platform caps at 1000/page             |
| `ETL_DGI_MAX_PAGES`   | `20`                                   | Guard against runaway pagination       |

Plus the core ETL config (`ETL_*`, `DATABASE_URL`) — see
[`src/core/config.ts`](../../src/core/config.ts).

## Field mapping (API → `commodity_prices`)

| API field      | Column              | Notes                                                                                       |
| -------------- | ------------------- | ------------------------------------------------------------------------------------------- |
| `district`     | `district_lgd_code` | Resolved from `districts.name_en` (case-insensitive); unmatched districts are dead-lettered |
| `market`       | `market`            | Trimmed, whitespace collapsed                                                               |
| `commodity`    | `commodity`         | Trimmed                                                                                     |
| `variety`      | `variety`           | Trimmed                                                                                     |
| `grade`        | `grade`             | Defaults to `other` when absent                                                             |
| `min_price`    | `min_price`         | INR per quintal                                                                             |
| `max_price`    | `max_price`         | INR per quintal                                                                             |
| `modal_price`  | `modal_price`       | INR per quintal                                                                             |
| `arrival_date` | `price_date`        | Converted from `DD/MM/YYYY` → `YYYY-MM-DD`                                                  |

`state` is used only for filtering/validation, not stored.

## Validation and failure handling

Records are dead-lettered (run continues, status `partial`-free) when they:

- miss a required field (`state`, `district`, `market`, `commodity`, `variety`)
- have a non-numeric or negative price, or `max_price < min_price`
- have an unparseable or future `arrival_date`
- map to a district absent from the `districts` hierarchy table

Duplicate natural keys within a run are removed by the `deduplicate` stage
(first occurrence wins); cross-run duplicates are absorbed by the `ON CONFLICT`
upsert. Fetch-level failures (non-2xx, invalid JSON) are retryable and retried
with exponential backoff.

## Known limitations

- **District matching is by exact `name_en`.** API names that differ from the
  LGD hierarchy (spelling, transliteration) are dead-lettered, not guessed.
  Curate `districts` or add an alias mapping before scaling up.
- **Dataset window.** The API serves a rolling window of recent days (all-India
  `total` ≈ 15k rows); historical depth is not guaranteed.
- **No arrivals tonnage.** This dataset carries prices only; arrivals live in a
  separate data.gov.in resource.
- **Max pages cap.** A dataset larger than `pageSize × maxPages` is truncated;
  the fetch metadata flags `truncated`.

## Decisions

- **Table named `commodity_prices`** (not PLANNING's `market_prices`) so the
  natural key can include `district_lgd_code`; the PLANNING key
  `(market, commodity, variety, price_date)` silently merges same-named markets
  across districts. `grade` is part of the key too.
- **District resolution in `validate`**: it is a referential-integrity check and
  keeps "reject invalid → dead-letter" semantics without framework changes.
  Resolver is injectable (`DistrictResolver`), so unit tests need no database.

## Running a real import

```bash
# 1. Apply the migration and seed districts
npm run db:migrate

# 2. Opt-in integration run against the real API + DB
ETL_DGI_RUN_INTEGRATION=1 DATABASE_URL=… ETL_DGI_API_KEY=… npm test
```

The same wiring is exported as `runDataGovIn(config, sourceConfig, pool)` for a
scheduled runner (GitHub Actions cron).
