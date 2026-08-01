# AGENTS.md

Guidance for AI coding agents working in this repo. Goal: work fast, burn few
tokens, and never break the conventions below. Human docs: [DEVELOPMENT.md](DEVELOPMENT.md)
(run/setup), [CONTRIBUTING.md](CONTRIBUTING.md) (git rules), [docs/architecture.md](docs/architecture.md)
(structure), [docs/PLANNING.md](docs/PLANNING.md) (decisions/roadmap — source of truth).

## Repo at a glance

```
gramledger/
├── apps/api/        Cloudflare Worker — Hono + TypeScript, versioned REST API
├── apps/mobile/     Flutter app — Android + Web PWA (Marathi-first, bilingual)
├── database/        PostgreSQL (Neon) — SQL migrations + seeds (node-pg-migrate)
├── etl/             ingestion framework — shared pipeline, sinks, source modules
├── packages/        shared packages (empty; see packages/README.md before adding)
├── docs/            PLANNING.md + architecture.md
├── scripts/         repo-wide scripts (setup/lint/format/test/build/clean)
└── .githooks/       pre-commit hook (prettier + dart format on staged files)
```

- **TS workspaces**: npm workspaces = `apps/api`, `database`, `etl`. Root `package.json`
  holds security `overrides` — do not remove.
- **Node >= 20. Wrangler is pinned to v3** (Node 20 compatible) — do not bump to v4.
- **Flutter** uses its own toolchain under `apps/mobile`; driven by repo scripts.
- Android `applicationId` is `com.gramledger.app`; **no Android SDK on this machine** —
  web build is the local verification path.

## Hard constraints

1. **Never commit secrets**: `.dev.vars`, `.env`, `.wrangler/`, build output.
2. **Workers runtime has no Node builtins.** `node:crypto` etc. break deploys.
   Use Web Crypto (`crypto.randomUUID()`) and `fetch`.
3. **Hono env typing is nested**: `AppEnv = { Bindings; Variables }` (see
   `apps/api/src/config.ts`). Don't flatten it to a single `Env` interface.
4. **Errors use the envelope** `{ error: { code, message, details? } }` produced by
   the `error-handler` middleware. Don't return ad-hoc error shapes.
5. **Versioned API contract**: all feature endpoints mount under `/v1`
   (`src/routes/v1/`). Never mutate an existing endpoint's payload — add a version.
6. **Never edit applied DB migrations.** Add a new one
   (`npm run db:migrate:create -- <change>`). SQL-only, with an up _and_ down.
7. **Generated files are not edited**: `apps/mobile/lib/l10n/app_localizations*.dart`.
   Edit the ARB sources (`app_en.arb` / `app_mr.arb`) and run `flutter gen-l10n`.
8. **No new dependencies** without a stated reason — check existing deps and
   `packages/README.md` first. Prefer what's already vendored.
9. **Match existing style** (Prettier + `dart format`, strict TS, strict Flutter
   lints). Avoid gratuitous comments.

## Commands (use these; don't reinvent)

| Purpose         | Command                                                |
| --------------- | ------------------------------------------------------ |
| Setup           | `npm run setup`                                        |
| Lint            | `npm run lint` / `npm run lint:fix`                    |
| Format          | `npm run format` / `npm run format:check`              |
| Test            | `npm run test` (vitest + flutter test)                 |
| Build/typecheck | `npm run build`                                        |
| Run API         | `npm run dev:api` (→ :8787/health)                     |
| DB migrate      | `npm run db:migrate` / `db:migrate:create` / `db:seed` |

Fast single-project loops: `npm run <x> --workspace apps/api` or
`flutter analyze|test` inside `apps/mobile`.

## Per-workspace gotchas

### apps/api (Workers + Hono)

- API tests drive `buildApp().request(...)` (no network).
  `testBindings = { ENVIRONMENT: 'test', LOG_LEVEL: 'error' }`.
- Config via `getConfig(bindings)`; non-secret vars in `wrangler.toml` `[vars]`,
  local secrets in `.dev.vars`, prod secrets via `wrangler secret put`.
- `ZodError` → 400 `VALIDATION_ERROR` automatically; unexpected errors → 500
  `INTERNAL_ERROR` (logged with request id). `/health` stays unversioned.

### apps/mobile (Flutter)

- Riverpod 3 (`NotifierProvider`) + go_router; Material 3, seed `0xFF2E7D32`,
  font `Mukta`. Use the existing `RadioGroup` ancestor for theme mode (the
  deprecated `groupValue/onChanged` RadioListTile API is gone in Flutter 3.44).
- Runtime config is compile-time `--dart-define` (`lib/core/config/app_config.dart`):
  `API_BASE_URL`, `ENVIRONMENT`, `DEFAULT_LOCALE`. Don't add runtime config.
- Marathi (`mr`) is the default locale; ARB keys must exist in both files.

### etl (Node ETL framework)

- Shared pipeline (`src/core/pipeline.ts`): sources implement stage functions
  (`fetch`, `parse`, `validate`, `normalize`, optional `deduplicate`/`transform`)
  and wire them with `createPipeline`. Reuse `createUpsertLoader`,
  `FileDeadLetterSink`, `createPostgresAuditSink` from `src/sinks/`.
- Only `fetch` retries (retryable `ETLError`); load failures dead-letter and
  the run reports `partial`. Config is env-driven (`ETL_*`, see `src/core/config.ts`).
- Tests are `tests/*.test.ts`; the Postgres integration test skips when
  `DATABASE_URL` is unset. Extension guide: `etl/README.md` + `sources/example/`.
- `ingestion_runs.source` is CHECK-constrained to the canonical source names
  (`egramswaraj`, `data_gov_in`, `imd`, `agmarknet`, `lgd`) — use them in tests.

### database

- Migrations: `node-pg-migrate` (SQL). Connection is `DATABASE_URL` in
  `database/.env` (Neon). Seeds (`database/seeds/`) only for reference data.

## Git & CI

- Branch: `<type>/<desc>` (e.g. `feat/panchayat-search`); commits: Conventional
  Commits, scopes `api|mobile|db|etl|scripts|docs`.
- Pre-commit hook enforces Prettier/`dart format` on staged files; CI (`.github/
workflows/ci.yml`) enforces lint + typecheck + tests. Don't bypass unless asked.

## Working style

Four instincts, in priority order. If they conflict with the token-efficiency
playbook below, correctness and compatibility win.

1. **Think before coding.** Don't assume. Don't hide confusion. Surface tradeoffs.
   - State assumptions explicitly; if uncertain, ask.
   - If multiple interpretations exist, present them — don't pick silently.
   - If a simpler approach exists, say so; push back when warranted.
   - If something is unclear, stop, name what's confusing, and ask.

2. **Simplicity first.** Minimum code that solves the problem. Nothing speculative.
   - No features beyond what was asked; no abstractions for single-use code; no
     "flexibility" or "configurability" that wasn't requested; no error handling
     for impossible scenarios.
   - If you write 200 lines and it could be 50, rewrite it.
   - Ask: "Would a senior engineer call this overcomplicated?" If yes, simplify.

3. **Surgical changes.** Touch only what you must. Clean up only your own mess.
   - Don't "improve" adjacent code, comments, or formatting. Don't refactor what
     isn't broken. Match existing style, even if you'd do it differently.
   - Notice unrelated dead code and mention it — don't delete it.
   - Remove imports/variables/functions that _your_ changes made unused; leave
     pre-existing dead code alone.
   - The test: every changed line traces directly to the request.

4. **Goal-driven execution.** Define success criteria; loop until verified.
   - Turn tasks into verifiable goals: "add validation" → tests for invalid
     inputs pass; "fix the bug" → a test reproduces it, then passes; "refactor X"
     → tests pass before and after.
   - For multi-step tasks, state a brief plan: `1. [step] → verify: [check]`.
   - Weak criteria ("make it work") force constant clarification — prefer strong ones.

## Token-efficiency playbook

- **Read narrowly**: open only the files you'll change or the exact section you
  need; use search for identifiers instead of whole-file reads. Don't re-read
  files you already have in context.
- **Use the repo scripts** above rather than composing ad-hoc commands.
- **Check the diff before finalizing** and run the cheapest relevant gate
  (`npm run format:check`, `npm run lint`, then `npm run test`) — CI is the
  backstop, not the first line.
- **Report with `path:line` references**; keep prose to one or two sentences per
  answer unless asked to explain.
- **Don't commit or push unless explicitly asked.**
- If a task spans multiple files, explore first, plan, then implement in focused
  steps — avoid wide speculative edits.
