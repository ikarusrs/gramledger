# SQL migrations for the GramLedger PostgreSQL database.

## Conventions

- Managed by [`node-pg-migrate`](https://github.com/salsita/node-pg-migrate).
- Create a new migration with:

  ```bash
  npm run db:migrate:create -- --name <describe-the-change>
  ```

  then write the SQL in the generated `<timestamp>_<name>.sql` file.
- Apply / roll back with `npm run db:migrate` / `npm run db:migrate:down`.
- Migrations run against the `DATABASE_URL` in `database/.env`.
- One concern per migration; add the `down` SQL to keep rollbacks safe.
- Never edit an already-applied migration — add a new one.
- Schema is currently **empty by design** (bootstrap phase). No tables yet.
