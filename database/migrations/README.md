# SQL migrations for the GramLedger PostgreSQL database.

## Conventions

- Managed by [`node-pg-migrate`](https://github.com/salsita/node-pg-migrate).
- Create a new migration with:

  ```bash
  npm run db:migrate:create -- <describe-the-change>
  ```

  then write the SQL in the generated `<timestamp>_<name>.sql` file.
- Apply / roll back with `npm run db:migrate` / `npm run db:migrate:down`.
- Migrations run against the `DATABASE_URL` in `database/.env`; the test
  database uses `database/.env.test` via `npm run db:migrate:test`.
- One concern per migration; add the `down` SQL to keep rollbacks safe.
- Never edit an already-applied migration — add a new one.

## Migration set

| File                          | Adds                                                                 |
| ----------------------------- | -------------------------------------------------------------------- |
| `*_extensions.sql`            | `pg_trgm` extension                                                   |
| `*_hierarchy.sql`             | states, districts, talukas, panchayats, villages + search indexes     |
| `*_governance.sql`            | schemes, profiles, grants, expenditures, works, assets, prices, weather |
| `*_users.sql`                 | users, otp_tokens, sessions, favorites, search_history, feedback      |
| `*_etl-metadata.sql`          | ingestion_runs, ingestion_snapshots                                   |

See `database/README.md` for the full schema reference and indexing strategy.
