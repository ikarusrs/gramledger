# Seed data for the GramLedger PostgreSQL database.

## Conventions

- Reference/hierarchy seed data (LGD codes, districts, talukas) and any curated
  catalogs (government schemes) live here.
- Seeds are idempotent where possible (`ON CONFLICT DO NOTHING`) so they can be
  re-run safely.
- Run all seeds with `npm run db:seed`.
- Do **not** put transactional business data in seeds — that belongs in ETL.
