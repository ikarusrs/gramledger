-- Up Migration
-- Governance / financial tables. Money rows are keyed by natural keys so the
-- eGramSwaraj ETL can upsert idempotently (see UNIQUE constraints).
-- `fy` stores the fiscal year start year (e.g. 2024 = FY 2024-25).
-- Curated catalog of government schemes (manual + official docs).
CREATE TABLE schemes (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code text NOT NULL,
    name_mr text NOT NULL,
    name_en text NOT NULL,
    ministry text,
    description text,
    eligibility jsonb,
    CONSTRAINT uq_schemes_code UNIQUE (code),
    CONSTRAINT ck_schemes_names CHECK (name_mr <> '' AND name_en <> '')
);

CREATE INDEX idx_schemes_name_en_trgm ON schemes USING gin (name_en gin_trgm_ops);

-- One profile row per panchayat (eGramSwaraj "profile" scrape).
CREATE TABLE panchayat_profiles (
    panchayat_id bigint PRIMARY KEY REFERENCES panchayats (id),
    sarpanch_name text,
    secretary_name text,
    contact_phone text,
    elected_committee jsonb,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE grants (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    panchayat_id bigint NOT NULL REFERENCES panchayats (id),
    fy integer NOT NULL,
    scheme_id bigint NOT NULL REFERENCES schemes (id),
    source text NOT NULL,
    amount numeric(14, 2) NOT NULL,
    disbursed_at date,
    CONSTRAINT uq_grants_panchayat_fy_scheme UNIQUE (panchayat_id, fy, scheme_id),
    CONSTRAINT ck_grants_fy CHECK (fy BETWEEN 2000 AND 2100),
    CONSTRAINT ck_grants_amount CHECK (amount >= 0),
    CONSTRAINT ck_grants_source CHECK (source <> '')
);

CREATE TABLE expenditures (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    panchayat_id bigint NOT NULL REFERENCES panchayats (id),
    fy integer NOT NULL,
    scheme_id bigint NOT NULL REFERENCES schemes (id),
    head text NOT NULL,
    amount numeric(14, 2) NOT NULL,
    CONSTRAINT uq_expenditures_pk_fy_scheme_head UNIQUE (panchayat_id, fy, scheme_id, head),
    CONSTRAINT ck_expenditures_fy CHECK (fy BETWEEN 2000 AND 2100),
    CONSTRAINT ck_expenditures_amount CHECK (amount >= 0),
    CONSTRAINT ck_expenditures_head CHECK (head <> '')
);

-- `status` is intentionally free text: portal status values vary across
-- states/years and over-constraining them would break ETL batches.
CREATE TABLE public_works (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    panchayat_id bigint NOT NULL REFERENCES panchayats (id),
    fy integer NOT NULL,
    title text NOT NULL,
    status text,
    sanctioned_amount numeric(14, 2),
    spent_amount numeric(14, 2),
    start_date date,
    end_date date,
    geo_tag jsonb,
    CONSTRAINT ck_public_works_fy CHECK (fy BETWEEN 2000 AND 2100),
    CONSTRAINT ck_public_works_sanctioned CHECK (sanctioned_amount IS NULL OR sanctioned_amount >= 0),
    CONSTRAINT ck_public_works_spent CHECK (spent_amount IS NULL OR spent_amount >= 0),
    CONSTRAINT ck_public_works_title CHECK (title <> '')
);

CREATE INDEX idx_public_works_panchayat_fy ON public_works (panchayat_id, fy);

CREATE INDEX idx_public_works_panchayat_status ON public_works (panchayat_id, status);

CREATE TABLE assets (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    panchayat_id bigint NOT NULL REFERENCES panchayats (id),
    category text,
    description text,
    value numeric(14, 2),
    status text,
    CONSTRAINT ck_assets_value CHECK (value IS NULL OR value >= 0)
);

CREATE INDEX idx_assets_panchayat_id ON assets (panchayat_id);

-- Agmarknet / data.gov.in daily market prices (₹/quintal).
-- `variety` defaults to '' so the dedupe key is reliable when a variety is
-- absent in the source feed.
CREATE TABLE market_prices (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    market text NOT NULL,
    district_id bigint REFERENCES districts (id),
    commodity text NOT NULL,
    variety text NOT NULL DEFAULT '',
    min_price numeric(12, 2) NOT NULL,
    max_price numeric(12, 2) NOT NULL,
    modal_price numeric(12, 2) NOT NULL,
    price_date date NOT NULL,
    CONSTRAINT uq_market_prices_market_commodity_variety_date UNIQUE (market, commodity, variety, price_date),
    CONSTRAINT ck_market_prices_min CHECK (min_price >= 0),
    CONSTRAINT ck_market_prices_max CHECK (max_price >= 0),
    CONSTRAINT ck_market_prices_modal CHECK (modal_price >= 0),
    CONSTRAINT ck_market_prices_ordering CHECK (min_price <= modal_price AND modal_price <= max_price),
    CONSTRAINT ck_market_prices_commodity CHECK (commodity <> ''),
    CONSTRAINT ck_market_prices_market CHECK (market <> '')
);

CREATE INDEX idx_market_prices_commodity_date ON market_prices (commodity, price_date);

CREATE INDEX idx_market_prices_district_date ON market_prices (district_id, price_date);

-- IMD forecast cache: one row per district per forecast issue. The PK order
-- lets "latest forecast for a district" read with a backward index scan.
CREATE TABLE weather_cache (
    district_id bigint NOT NULL REFERENCES districts (id),
    issued_at timestamptz NOT NULL,
    forecast jsonb NOT NULL,
    PRIMARY KEY (district_id, issued_at)
);

-- Down Migration
DROP TABLE IF EXISTS weather_cache;

DROP TABLE IF EXISTS market_prices;

DROP TABLE IF EXISTS assets;

DROP TABLE IF EXISTS public_works;

DROP TABLE IF EXISTS expenditures;

DROP TABLE IF EXISTS grants;

DROP TABLE IF EXISTS panchayat_profiles;

DROP TABLE IF EXISTS schemes;
