-- Up Migration
-- ETL audit tables. Every pipeline run writes an `ingestion_runs` row and may
-- snapshot its raw source to object storage (R2) before a destructive rebuild.
-- Canonical pipeline source names: egramswaraj, data_gov_in, imd, agmarknet, lgd.
CREATE TABLE ingestion_runs (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source text NOT NULL,
    status text NOT NULL DEFAULT 'running',
    rows_seen integer NOT NULL DEFAULT 0,
    rows_upserted integer NOT NULL DEFAULT 0,
    errors jsonb,
    started_at timestamptz NOT NULL DEFAULT now(),
    finished_at timestamptz,
    CONSTRAINT ck_ingestion_runs_source CHECK (source IN ('egramswaraj', 'data_gov_in', 'imd', 'agmarknet', 'lgd')),
    CONSTRAINT ck_ingestion_runs_status CHECK (status IN ('running', 'success', 'partial', 'failed')),
    CONSTRAINT ck_ingestion_runs_counts CHECK (rows_seen >= 0 AND rows_upserted >= 0),
    CONSTRAINT ck_ingestion_runs_finished CHECK (finished_at IS NULL OR finished_at >= started_at)
);

-- Health dashboard: recent runs per source.
CREATE INDEX idx_ingestion_runs_source_started ON ingestion_runs (source, started_at DESC);

CREATE TABLE ingestion_snapshots (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source text NOT NULL,
    taken_at timestamptz NOT NULL DEFAULT now(),
    s3_key text NOT NULL,
    CONSTRAINT uq_ingestion_snapshots_s3_key UNIQUE (s3_key),
    CONSTRAINT ck_ingestion_snapshots_source CHECK (source IN ('egramswaraj', 'data_gov_in', 'imd', 'agmarknet', 'lgd')),
    CONSTRAINT ck_ingestion_snapshots_s3_key_nonempty CHECK (s3_key <> '')
);

CREATE INDEX idx_ingestion_snapshots_source_taken ON ingestion_snapshots (source, taken_at DESC);

-- Down Migration
DROP TABLE IF EXISTS ingestion_snapshots;

DROP TABLE IF EXISTS ingestion_runs;
