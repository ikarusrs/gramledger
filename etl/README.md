# GramLedger ETL

Reusable ingestion framework: a pipeline of stages shared by every data source,
so a new source is just the source-specific stages + wiring.

## Pipeline

```
fetch → parse → validate → normalize → [deduplicate] → [transform] → load → report
```

| Stage         | Provided by | Required | Notes                                                                   |
| ------------- | ----------- | -------- | ----------------------------------------------------------------------- |
| `fetch`       | source      | yes      | Retrieves raw content; **retried** with backoff on retryable errors     |
| `parse`       | source      | yes      | `FetchResult` → records                                                 |
| `validate`    | source      | yes      | Returns `{ valid, invalid }`; invalid records are dead-lettered         |
| `normalize`   | source      | yes      | Clean/convert field values                                              |
| `deduplicate` | source      | optional | Returns `{ kept, removed }`; removed counted as skipped                 |
| `transform`   | source      | optional | May filter/enrich records                                               |
| `load`        | source      | yes      | Batched; a failed batch is dead-lettered, the run continues (`partial`) |
| `report`      | framework   | —        | `RunReport` persisted via the audit sink (e.g. `ingestion_runs`)        |

Every run ends in a `RunReport`: status (`success`/`partial`/`failed`), counts
(seen/upserted/skipped/failed/duplicates/validation), retries, warnings, errors,
timestamps. Canonical source names (DB check constraint): `egramswaraj`,
`data_gov_in`, `imd`, `agmarknet`, `lgd`.

## Adding a source (extension guide)

1. Implement the stage functions from `src/core/types.ts` in
   `sources/<name>/index.ts`. A real source fetches its data, parses it, and
   reuses the framework stages below.
2. For the loader, use `createUpsertLoader` from `src/sinks/postgres.ts` with a
   `Pool` (see `createPool`) — it batches an `INSERT … ON CONFLICT DO UPDATE`
   per `config.batchSize`.
3. Wire the stages with `createPipeline(source, stages, deps)` where `deps`
   carries the loaded `Config`. Return the `Pipeline` (or a ready-to-run
   function) so the scheduler can call `run()`.
4. Optional: attach a `DeadLetterSink` (`FileDeadLetterSink`) and an `AuditSink`
   (`createPostgresAuditSink`) in `deps`.

See `sources/example/index.ts` for the full reference implementation (all
in-memory, no network/DB, runnable as a demo). For a real-world source, see
`sources/data_gov_in/` (Agmarknet daily mandi prices) — paginated API client,
dead-lettering validation, district resolution, and a Postgres upsert loader.

```ts
// sources/<name>/index.ts — sketch
const fetch = async (ctx) => {
  /* fetch + retryable ETLError on flakiness */
};
const parse = async (input, ctx) => {
  /* raw → records */
};
const validate = async (records, ctx) => {
  /* { valid, invalid } */
};
const normalize = async (records, ctx) => {
  /* clean fields */
};

export function buildNamePipeline(config: Config): Pipeline {
  const pool = createPool(config);
  return createPipeline(
    'name',
    {
      fetch,
      parse,
      validate,
      normalize,
      load: createUpsertLoader({ pool, table: 'name', conflictColumns: ['natural_key'] }),
    },
    {
      config,
      deadLetter: new FileDeadLetterSink({ dir: config.deadLetterDir }),
      audit: createPostgresAuditSink({ pool }),
    },
  );
}
```

## Errors & retries

- Errors are `ETLError`s carrying a stable `code` (`CONFIG_ERROR`, `FETCH_ERROR`,
  `PARSE_ERROR`, `VALIDATION_ERROR`, `LOAD_ERROR`, `PIPELINE_ERROR`) and
  serialize to `{ error: { code, message, details }, retryable }`.
- Only `fetch` is retried (transient network errors marked
  `{ retryable: true }`); settings under `ETL_RETRY_*`.
- Loader upserts are idempotent by natural key, so re-running a failed batch is
  safe.

## Configuration

See `src/core/config.ts` for the full table. All env-driven with defaults:

| Variable                    | Default            |
| --------------------------- | ------------------ |
| `ETL_ENV`                   | `development`      |
| `ETL_LOG_LEVEL`             | `info`             |
| `ETL_RETRY_ATTEMPTS`        | `3`                |
| `ETL_RETRY_BASE_BACKOFF_MS` | `1000`             |
| `ETL_RETRY_MAX_BACKOFF_MS`  | `30000`            |
| `ETL_BATCH_SIZE`            | `1000`             |
| `ETL_DEAD_LETTER_DIR`       | `etl/.dead-letter` |
| `DATABASE_URL`              | _(optional)_       |

## Development

```bash
npm run typecheck --workspace etl
npm run lint      --workspace etl
npm run test      --workspace etl            # unit tests (vitest)
DATABASE_URL=… npm run test --workspace etl  # + Postgres integration tests
```

The DB integration test (`tests/db.integration.test.ts`) requires a reachable
Postgres with the `database` migrations applied (it writes to `ingestion_runs`
and a scratch `etl_int_prices` table); it skips automatically when
`DATABASE_URL` is unset.
