# GramLedger

A mobile application for Maharashtra that improves **Panchayat transparency** and
provides **AI-powered farmer assistance**, built exclusively on official open data.

**Status:** repository bootstrapped (foundation only — no features yet).
See [docs/PLANNING.md](docs/PLANNING.md) for the approved architecture and
roadmap, and [docs/architecture.md](docs/architecture.md) for how the repo is
structured.

## Stack

| Layer    | Technology                                                           |
| -------- | -------------------------------------------------------------------- |
| Mobile   | Flutter (Android + Web PWA) — Marathi-first, bilingual               |
| API      | Cloudflare Workers — Hono / TypeScript, versioned REST               |
| Database | PostgreSQL on Neon (raw Postgres), SQL migrations                    |
| Storage  | Cloudflare R2 (planned)                                              |
| ETL      | GitHub Actions cron → scraping/pull pipelines (planned)              |
| AI       | Gemini Flash (RAG chatbot) · on-device TFLite (Phase 2) · rule-based |

## Key decisions

- **No Rust backend for MVP** — thin, edge-cached API on Cloudflare Workers.
- **Neon PostgreSQL** with in-house auth (email OTP + JWT).
- **eGramSwaraj has no public API** → isolated scraper + drift alerting is the
  project's highest-risk component (see `etl/`).
- **Android + Web PWA first**; iOS deferred to Phase 2.
- **Official open data only** — data.gov.in, IMD, Agmarknet, public eGramSwaraj
  reports.

## Repository layout

```
apps/mobile/    Flutter application
apps/api/       Cloudflare Workers API (Hono)
database/       SQL migrations + seeds (node-pg-migrate)
etl/            Ingestion pipelines (placeholder)
packages/       Shared packages (placeholder)
docs/           Planning + architecture documentation
scripts/        Repo-wide developer scripts
```

## Quick start

```bash
npm run setup    # installs deps, Flutter pub get, git hooks, env files
npm run dev:api  # run the API at http://localhost:8787/health
cd apps/mobile && flutter run -d chrome   # run the app
```

See [DEVELOPMENT.md](DEVELOPMENT.md) for the full setup and daily workflow,
and [CONTRIBUTING.md](CONTRIBUTING.md) for how to contribute (branch + commit
conventions, quality gates).

## Project goals

Simple · Maintainable · Low-cost · Scalable · Production-ready · Official open data only
