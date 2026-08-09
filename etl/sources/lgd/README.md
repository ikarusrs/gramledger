# LGD — administrative hierarchy (village→Gram Panchayat mapping)

The second real source built on the ETL framework. It ingests the **LGD**
(Local Government Directory) **village-to-Gram-Panchayat mapping** dataset —
the official national reference for administrative geography — into the five
hierarchy tables (`states`, `districts`, `talukas`, `panchayats`, `villages`).

- Pipeline source name: `lgd` (matches the `ingestion_runs` CHECK)
- Data license: GODL-compatible (Government Open Data — India); LGD data is
  published by the Ministry of Panchayati Raj on the Indian open-data portal.

## Data contract

LGD publishes the full administrative chain on **every** row of the
village→GP mapping: `state_code/name`, `district_code/name`,
`sub_district_code/name`, `block_code/name`, `local_body_code/name/type` and
`village_code/name`. One source file therefore populates every hierarchy
table. Codes arrive as zero-padded strings (`'000052'`), plain numbers, or the
sentinel `'None'`/null for villages not (yet) mapped to any Gram Panchayat.

The source reads the dataset through a CKAN `datastore_search` endpoint, which
is how the LGD resource is served on the open-data portal
(`ckandev.indiadataportal.com` in the wild). The contract is the documented
resource fields above plus `{ success, result: { records, total } }` envelopes
with `offset` pagination — the same shape the portal's API exposes to the
registered LGD resources.

## Module layout

```
sources/lgd/
├── config.ts     env → LgdConfig (ETL_LGD_*)
├── client.ts     CKAN datastore_search page client + fetch stage
├── mapping.ts    raw row → LgdRow; parse/normalize/deduplicate
├── validate.ts   syntactic checks (dead-letter rejects)
├── loader.ts     hierarchy loader: upserts all 5 tables in FK order
├── index.ts      pipeline wiring (createPipeline + custom loader)
└── README.md     this file
```

## Configuration

| Variable              | Default                                             | Notes                                   |
| --------------------- | --------------------------------------------------- | --------------------------------------- |
| `ETL_LGD_BASE_URL`    | `https://ckandev.indiadataportal.com/api/3/action/datastore_search` | Overridable for tests/proxies |
| `ETL_LGD_RESOURCE_ID` | _(required)_                                        | The LGD village→GP mapping resource id  |
| `ETL_LGD_PAGE_SIZE`   | `1000`                                              | Records per page                        |
| `ETL_LGD_MAX_PAGES`   | `20`                                                | Guard against runaway pagination        |

Plus the core ETL config (`ETL_*`, `DATABASE_URL`) — see
[`src/core/config.ts`](../../src/core/config.ts).

## Field mapping (resource → hierarchy tables)

Each raw record maps to a `LgdRow` carrying the whole chain. The `loader`
fans each batch out into the five tables in FK order, `ON CONFLICT
(lgd_code)`:

| Hierarchy level | LGD source field          | Target table / column            |
| --------------- | ------------------------- | -------------------------------- |
| State           | `state_code`, `state_name` | `states`                         |
| District        | `district_code`, `district_name` | `districts` (parent = state) |
| Sub-district    | `sub_district_code`, `sub_district_name` | `talukas` (parent = district) |
| Gram Panchayat  | `local_body_code`, `local_body_name`, `local_body_type` | `panchayats` (level `gram`) |
| Village         | `village_code`, `village_name` | `villages` (taluka + nullable panchayat) |

## Bilingual note

LGD ships English-only names. The hierarchy tables require `name_mr NOT NULL`,
so `name_mr` currently receives a **copy of the English name** as a
placeholder. A future transliteration pass replaces it with real Marathi.
Tracked in `docs/PLANNING.md` / `docs/DATA_SOURCE_AUDIT.md`.

## Validation and failure handling

Records are dead-lettered (run continues) when they:

- carry a missing/non-numeric code for state, district, sub-district, or village
- carry an empty name at any required level
- specify a `local_body_code` without a `local_body_name`

Unmapped villages (`local_body_code = 'None'`) are **valid** — the village
loads with `panchayat_id = NULL`, exactly as the schema intends.

## Decisions

- **One pipeline run, one source, five tables.** Because every LGD row carries
  its whole ancestry, the loader resolves parents in SQL by joining the
  already-upserted parent table on `lgd_code`; no framework changes were
  needed.
- **`name_mr` placeholder** as above.
- **`ingestion_runs` per run.** A full LGD run is audited as one `lgd` run;
  the loader reports village upserts as the run's row count.
- **Idempotent.** Every upsert is `ON CONFLICT (lgd_code) DO UPDATE`, so
  re-running the source is a no-op unless data changed (monthly refresh).

## Running a real import

```bash
# 1. Apply migrations (hierarchy tables) and seed
npm run db:migrate

# 2. Point at the LGD resource and run the source's tests
ETL_LGD_RUN_INTEGRATION=1 DATABASE_URL=… ETL_LGD_RESOURCE_ID=… npm test
```

The same wiring is exported as `runLgd(config, sourceConfig, pool)` for a
scheduled runner (GitHub Actions cron).