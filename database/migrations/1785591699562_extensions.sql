-- Up Migration
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Down Migration
DROP EXTENSION IF EXISTS pg_trgm;
