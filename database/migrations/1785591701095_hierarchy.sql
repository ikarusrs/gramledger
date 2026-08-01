-- Up Migration
-- Reference / hierarchy tables. Static LGD-based administrative geography.
-- All rows are keyed by `lgd_code` (Local Government Directory) so the LGD
-- ETL pipeline can idempotently upsert without relying on surrogate ids.
CREATE TABLE states (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    lgd_code bigint NOT NULL,
    name_mr text NOT NULL,
    name_en text NOT NULL,
    CONSTRAINT uq_states_lgd_code UNIQUE (lgd_code),
    CONSTRAINT ck_states_names CHECK (name_mr <> '' AND name_en <> '')
);

CREATE TABLE districts (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    state_id bigint NOT NULL REFERENCES states (id),
    lgd_code bigint NOT NULL,
    name_mr text NOT NULL,
    name_en text NOT NULL,
    CONSTRAINT uq_districts_lgd_code UNIQUE (lgd_code),
    CONSTRAINT ck_districts_names CHECK (name_mr <> '' AND name_en <> '')
);

CREATE INDEX idx_districts_state_id ON districts (state_id);

CREATE INDEX idx_districts_name_en ON districts (name_en);

CREATE TABLE talukas (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    district_id bigint NOT NULL REFERENCES districts (id),
    lgd_code bigint NOT NULL,
    name_mr text NOT NULL,
    name_en text NOT NULL,
    CONSTRAINT uq_talukas_lgd_code UNIQUE (lgd_code),
    CONSTRAINT ck_talukas_names CHECK (name_mr <> '' AND name_en <> '')
);

CREATE INDEX idx_talukas_district_id ON talukas (district_id);

CREATE INDEX idx_talukas_name_en ON talukas (name_en);

-- Panchayat Raj Institutions. `level` maps to the three tiers:
--   gram   = Gram Panchayat (village cluster)   [default]
--   block  = Panchayat Samiti / Block Panchayat
--   district = District Panchayat / Zilla Parishad
-- `geojson_polygon_id` is a forward-compatible FK slot for a future
-- geojson_polygons table (Phase 2/3 GIS); no FK is declared yet.
CREATE TABLE panchayats (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    state_id bigint NOT NULL REFERENCES states (id),
    district_id bigint NOT NULL REFERENCES districts (id),
    taluka_id bigint NOT NULL REFERENCES talukas (id),
    lgd_code bigint NOT NULL,
    name_mr text NOT NULL,
    name_en text NOT NULL,
    level text NOT NULL DEFAULT 'gram',
    geojson_polygon_id bigint,
    CONSTRAINT uq_panchayats_lgd_code UNIQUE (lgd_code),
    CONSTRAINT ck_panchayats_level CHECK (level IN ('gram', 'block', 'district')),
    CONSTRAINT ck_panchayats_names CHECK (name_mr <> '' AND name_en <> '')
);

CREATE INDEX idx_panchayats_state_id ON panchayats (state_id);

CREATE INDEX idx_panchayats_district_id ON panchayats (district_id);

CREATE INDEX idx_panchayats_taluka_id ON panchayats (taluka_id);

-- Trigram search (pg_trgm): Marathi is the default UI locale, so both scripts
-- are indexed. GIN is used instead of GiST (from the plan) because it is the
-- recommended index type for pg_trgm and is faster for high-cardinality reads.
CREATE INDEX idx_panchayats_name_en_trgm ON panchayats USING gin (name_en gin_trgm_ops);

CREATE INDEX idx_panchayats_name_mr_trgm ON panchayats USING gin (name_mr gin_trgm_ops);

-- `panchayat_id` is nullable: a village may exist in LGD before it is mapped
-- to a Gram Panchayat (ETL backfills the mapping).
CREATE TABLE villages (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    taluka_id bigint NOT NULL REFERENCES talukas (id),
    panchayat_id bigint REFERENCES panchayats (id),
    lgd_code bigint NOT NULL,
    name_mr text NOT NULL,
    name_en text NOT NULL,
    CONSTRAINT uq_villages_lgd_code UNIQUE (lgd_code),
    CONSTRAINT ck_villages_names CHECK (name_mr <> '' AND name_en <> '')
);

CREATE INDEX idx_villages_taluka_id ON villages (taluka_id);

CREATE INDEX idx_villages_panchayat_id ON villages (panchayat_id);

CREATE INDEX idx_villages_name_en_trgm ON villages USING gin (name_en gin_trgm_ops);

CREATE INDEX idx_villages_name_mr_trgm ON villages USING gin (name_mr gin_trgm_ops);

-- Down Migration
DROP TABLE IF EXISTS villages;

DROP TABLE IF EXISTS panchayats;

DROP TABLE IF EXISTS talukas;

DROP TABLE IF EXISTS districts;

DROP TABLE IF EXISTS states;
