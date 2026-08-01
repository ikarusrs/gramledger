# Architecture

> Source of truth for **why** the system is built this way. For the full 21-section
> engineering plan (feature matrix, cost, risk, roadmap), see
> [PLANNING.md](PLANNING.md). This document summarizes the structure that has
> been scaffolded and the conventions that govern it.

## Repo layout

```
gramledger/
├── apps/
│   ├── api/          # Cloudflare Worker — Hono (TypeScript), versioned REST API
│   └── mobile/       # Flutter app — Android + Web PWA (Marathi-first, bilingual)
├── database/         # PostgreSQL (Neon) migrations + seeds (node-pg-migrate)
├── etl/              # Ingestion pipelines (placeholder — not implemented)
├── packages/         # Shared TS/Dart packages (placeholder — none yet)
├── docs/             # Planning + architecture documentation
└── scripts/          # Repo-wide developer scripts (setup/lint/format/test/...)
```

npm workspaces cover the TypeScript projects (`apps/api`, `database`). Flutter
uses its own toolchain inside `apps/mobile` and is driven by the repo scripts.

## Key decisions (from PLANNING.md)

1. **Thin API on Cloudflare Workers (Hono/TypeScript).** No Rust backend for
   MVP — the API is a stateless, edge-cached, rate-limited proxy over Postgres
   and AI providers. Rust returns only as an optional ETL parser / Phase-3
   compute worker.
2. **Neon PostgreSQL** (raw Postgres) with in-house auth (email OTP + JWT).
   All schema changes are SQL migrations in `database/migrations/`.
3. **eGramSwaraj is scraped.** It has no public API; its HTML `.do` report
   endpoints are the only source for grants/expenditure/works data. This is the
   project's **highest-risk component** and will be built as an isolated,
   alerting, snapshotting ETL job (see `etl/`).
4. **Bilingual, Marathi-first UI** (`mr` default, `en` toggle) with a bundled
   Devanagari font (`Mukta`) for consistent rendering on low-end devices.
5. **Android + Web PWA first**; iOS deferred to Phase 2.
6. **Light AI.** Managed LLM (Gemini Flash) RAG chatbot, on-device TFLite for
   crop/pest detection (Phase 2), rule-based recommendations. No GPU, ever.
7. **Official open data only** — data.gov.in, IMD, Agmarknet, plus politely
   scraped public eGramSwaraj reports.

## How the pieces fit

```
Flutter (Android + Web PWA)        GitHub Actions cron (future ETL)
        │ REST + JWT                              │
        ▼                                         ▼
  Cloudflare Workers (Hono)  ──────────►  Neon PostgreSQL
   ├─ /auth/*   email OTP + JWT
   ├─ /v1/*     read APIs (cached, rate-limited, AI proxy)
   └─ /upload   R2 presigned URLs
```

- **API versioning**: everything user-facing lives under `/v1`; the health
  check is unversioned. See `apps/api/src/routes/v1/`.
- **Database access**: read-only role for public reads, least-privilege service
  role for ETL, parameterized queries only.
- **Offline**: the mobile app caches read-only public data locally
  (stale-while-revalidate); no write-sync needed because users only write
  lightweight account data.

## Conventions

- **Migrations as code**: SQL-only, one concern per file, timestamped by
  node-pg-migrate. Never edit applied migrations — add new ones.
- **Versioned API contract**: feature branches add routes under `v1`, never
  modify existing endpoints' payloads without a new version.
- **Errors**: the API returns a consistent `{ error: { code, message, details? } }`
  envelope (see `apps/api/src/middleware/error-handler.ts`).
- **Secrets**: never in the repo. Worker secrets via `wrangler secret`;
  local dev via `.dev.vars`; CI via GitHub Secrets.

## Open items before feature development

- Decide the API data-access library (postgres.js vs @neondatabase/serverless)
  when the first `/v1` feature endpoint lands.
- Decide Dart API-client generation strategy (hand-written vs generated from the
  TypeScript contract) — see `packages/`.
- Define the ETL scheduler (GitHub Actions cron) and scraper modules in `etl/`.
