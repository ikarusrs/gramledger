-- Up Migration
-- Per-panchayat financial statements from the eGramSwaraj "Receipt and
-- Payment" report family. Each row is one period (month, opening balance, or
-- total) for one panchayat in one financial year. `source` distinguishes the
-- report the row came from:
--   egramswaraj_monthly  -> GP "Month Wise Payment and Receipt Statement"
--   egramswaraj_village  -> block "Village wise Receipt and Payment Statement"
-- `month_no` is the fiscal-year month (April = 1 … March = 12); NULL for
-- opening-balance and total rows. `period` holds the raw label (e.g. "April 2025").
CREATE TABLE financial_statements (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    panchayat_id bigint NOT NULL REFERENCES panchayats (id),
    fy integer NOT NULL,
    period text NOT NULL,
    month_no integer,
    receipts numeric(14, 2) NOT NULL DEFAULT 0,
    receipt_cancellation numeric(14, 2) NOT NULL DEFAULT 0,
    ob_cancellation numeric(14, 2) NOT NULL DEFAULT 0,
    payments numeric(14, 2) NOT NULL DEFAULT 0,
    payment_cancellation numeric(14, 2) NOT NULL DEFAULT 0,
    opening_balance numeric(14, 2),
    source text NOT NULL,
    fetched_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_financial_statements UNIQUE (panchayat_id, fy, period, source),
    CONSTRAINT ck_financial_statements_fy CHECK (fy BETWEEN 2000 AND 2100),
    CONSTRAINT ck_financial_statements_month CHECK (
        month_no IS NULL OR (month_no BETWEEN 1 AND 12)
    ),
    CONSTRAINT ck_financial_statements_source CHECK (source <> '')
);

CREATE INDEX idx_financial_statements_panchayat_fy ON financial_statements (panchayat_id, fy);

-- Down Migration
DROP TABLE IF EXISTS financial_statements;
