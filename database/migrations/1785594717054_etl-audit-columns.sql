-- Up Migration
-- Extends ingestion_runs so the ETL framework can persist the full RunReport
-- (skipped/failed counts, duplicates, validation failures, retries, warnings).
ALTER TABLE ingestion_runs
    ADD COLUMN rows_skipped integer NOT NULL DEFAULT 0,
    ADD COLUMN rows_failed integer NOT NULL DEFAULT 0,
    ADD COLUMN duplicates_removed integer NOT NULL DEFAULT 0,
    ADD COLUMN validation_failures integer NOT NULL DEFAULT 0,
    ADD COLUMN retry_count integer NOT NULL DEFAULT 0,
    ADD COLUMN warnings jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Down Migration
ALTER TABLE ingestion_runs
    DROP COLUMN rows_skipped,
    DROP COLUMN rows_failed,
    DROP COLUMN duplicates_removed,
    DROP COLUMN validation_failures,
    DROP COLUMN retry_count,
    DROP COLUMN warnings;
