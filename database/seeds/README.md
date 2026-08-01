# Seed data for the GramLedger PostgreSQL database.

## Conventions

- Reference/hierarchy seed data (LGD codes, districts, talukas) and any curated
  catalogs (government schemes) live here.
- Seeds are idempotent (`ON CONFLICT DO NOTHING`) and wrapped in a transaction
  where statements are related, so they can be re-run safely.
- Run all seeds with `npm run db:seed` (applies every `seeds/*.sql` in filename
  order via `scripts/seed.sh`).
- Do **not** put transactional business data in seeds — that belongs in ETL.

## Files

| File                    | Contents                                                            |
| ----------------------- | ------------------------------------------------------------------- |
| `hierarchy_sample.sql`  | Sample Maharashtra hierarchy (states/districts/talukas/panchayats/villages) with placeholder LGD codes. Replace with an authoritative LGD snapshot before public launch. |
