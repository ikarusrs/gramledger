-- Up Migration
-- Daily wholesale (mandi) prices per commodity/variety/grade, sourced from
-- Agmarknet via the data.gov.in API. Keyed by the natural key including
-- `district_lgd_code` (LGD codes, matching the hierarchy tables) so the ETL
-- pipeline can idempotently upsert without relying on surrogate ids. Prices are
-- INR per quintal as reported by the source.
CREATE TABLE commodity_prices (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    district_lgd_code bigint NOT NULL REFERENCES districts (lgd_code),
    market text NOT NULL,
    commodity text NOT NULL,
    variety text NOT NULL,
    grade text NOT NULL DEFAULT 'other',
    min_price numeric(12, 2) NOT NULL,
    max_price numeric(12, 2) NOT NULL,
    modal_price numeric(12, 2) NOT NULL,
    price_date date NOT NULL,
    CONSTRAINT uq_commodity_prices_natural_key UNIQUE (district_lgd_code, market, commodity, variety, grade, price_date),
    CONSTRAINT ck_commodity_prices_names CHECK (market <> '' AND commodity <> '' AND variety <> '' AND grade <> ''),
    CONSTRAINT ck_commodity_prices_prices CHECK (min_price >= 0 AND max_price >= 0 AND modal_price >= 0 AND max_price >= min_price)
);

CREATE INDEX idx_commodity_prices_commodity_date ON commodity_prices (commodity, price_date);

CREATE INDEX idx_commodity_prices_district_date ON commodity_prices (district_lgd_code, price_date);

-- Down Migration
DROP TABLE IF EXISTS commodity_prices;
