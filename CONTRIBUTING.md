# Contributing

Thanks for contributing to GramLedger. This repo is a monorepo with a Flutter
app, a Cloudflare Workers API, and PostgreSQL migrations. Please read
[DEVELOPMENT.md](DEVELOPMENT.md) to get the environment running first.

## Workflow

1. Branch from `main` using the naming convention below.
2. Make small, focused commits following the commit convention.
3. Open a Pull Request to `main`. CI runs lint + tests; the pre-commit hook
   runs fast local checks.
4. Request review; keep the PR description clear about what and why.

### Branch naming

Use `<type>/<short-description>`:

```
feat/panchayat-search
fix/etl-scheme-head-split
refactor/api-error-envelope
docs/localization-guide
```

### Commit convention

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body (optional)>

<footer (optional)>
```

- **Types**: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`,
  `build`, `ci`, `style`.
- **Scope** (optional): `api`, `mobile`, `db`, `etl`, `scripts`, `docs`.
- **Subject**: lowercase, imperative mood, ≤ 72 chars, no trailing period.
- **Breaking change**: add `!` after type/scope or a `BREAKING CHANGE:` footer.

Examples:

```
feat(mobile): add panchayat search screen

fix(api): return 400 for invalid fy query param

docs: document offline cache strategy

test(db): cover expenditure upsert idempotency
```

## Code quality gates

Run these before pushing (or rely on the pre-commit hook + CI):

```bash
npm run lint        # ESLint (api) + flutter analyze (mobile)
npm run format      # Prettier + dart format
npm run test        # Vitest (api) + flutter test (mobile)
npm run build       # Type-check (api) + flutter build web (mobile)
```

- New code must be covered by unit/widget tests.
- Public API additions must follow the `/v1` versioning contract
  (see [architecture.md](architecture.md)).
- Never commit secrets, `.dev.vars`, `.env`, or generated artifacts.

## Database changes

- Add a **migration** (`npm run db:migrate:create -- <change>`) and
  commit the SQL **and** its `down` script.
- Add seed data under `database/seeds/` only for reference/curated data;
  transactional data belongs to ETL.
- Never edit an already-applied migration.

## Code review

- Keep PRs small and reviewable; split large features.
- Prefer simpler solutions; when in doubt, ask the maintainers rather than
  introducing abstractions (see `packages/README.md`).

## Getting help

Open an issue for questions, bugs, or proposals. See [PLANNING.md](docs/PLANNING.md)
for the product roadmap and decisions.
