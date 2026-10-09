-- Up Migration
-- Per-panchayat scheme-wise expenditure/receipt totals from the eGramSwaraj
-- "Scheme-wise expenditure" drill-down (state -> district -> block -> village).
-- Each row is one panchayat's fiscal-year total under one scheme.
-- `scheme` stores the scheme NAME as published by the portal (denormalized);
-- the curated `schemes` catalog + FK is intentionally not used here because
-- source-specific scheme identity is unresolved (see docs/DATA_SOURCE_AUDIT.md).
-- `source` continues the `egramswaraj_*` naming convention.
CREATE TABLE scheme_expenditures (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    panchayat_id bigint NOT NULL REFERENCES panchayats (id),
    fy integer NOT NULL,
    scheme text NOT NULL,
    receipts numeric(14, 2) NOT NULL DEFAULT 0,
    payments numeric(14, 2) NOT NULL DEFAULT 0,
    source text NOT NULL,
    source_url text NOT NULL,
    source_hash text NOT NULL,
    fetched_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_scheme_expenditures UNIQUE (panchayat_id, fy, scheme, source),
    CONSTRAINT ck_scheme_expenditures_fy CHECK (fy BETWEEN 2000 AND 2100),
    CONSTRAINT ck_scheme_expenditures_scheme CHECK (scheme <> ''),
    CONSTRAINT ck_scheme_expenditures_money CHECK (receipts >= 0 AND payments >= 0),
    CONSTRAINT ck_scheme_expenditures_source CHECK (source <> '')
);

CREATE INDEX idx_scheme_expenditures_panchayat_fy ON scheme_expenditures (panchayat_id, fy);

-- Down Migration
DROP TABLE IF EXISTS scheme_expenditures;
