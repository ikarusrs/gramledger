# GramLedger — Master Planning Document

Status: **Approved** — plan only, no implementation yet.

Target: mobile application for Maharashtra improving Panchayat transparency and providing AI-powered farmer assistance, built on official open data.

Guiding principles: simple, maintainable, low-cost, scalable, production-ready, official open data only.

---

## 1. Executive Summary

GramLedger is a read-heavy civic-tech app. The bulk of engineering effort is in **data acquisition (ETL)** and **AI orchestration**, not in request serving. A dedicated application server therefore adds cost and ops burden with little benefit.

Recommended architecture:

- **Frontend**: Flutter, shipped as **Android app + Web PWA**, hosted on **Cloudflare Pages**.
- **API**: **Cloudflare Workers** (Hono / TypeScript) — thin, stateless, edge-cached, rate-limited.
- **Database**: **PostgreSQL on Neon** (raw Postgres) with **Cloudflare R2** for object storage.
- **Auth**: self-built in Workers on Neon (email OTP → short-lived JWT + refresh token).
- **ETL**: **GitHub Actions cron** jobs running an isolated scraper pipeline (eGramSwaraj HTML, data.gov.in, IMD, Agmarknet) with validation, deduplication, and drift alerting.
- **AI**: external LLM API (Gemini Flash) for the Marathi chatbot; **on-device TFLite** for crop/pest vision; **rule-based** logic for recommendations and anomaly detection.
- **No Rust backend for MVP.** Rust may appear only as an optional ETL parser or a Phase-3 dedicated compute worker. Axum is not justified as the primary API surface.

Key constraints confirmed during research:

| Source      | Status                                                                                               | Implication                                                                                |
| ----------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| eGramSwaraj | **No public API**; data served through HTML `.do` report endpoints, citizen-accessible without login | Core panchayat financial data requires **HTML scraping** → the single biggest project risk |
| data.gov.in | Free API key; per-request caps                                                                       | Good for market prices and auxiliary datasets                                              |
| IMD         | Official free API (`api.imd.gov.in/api/v1/...`)                                                      | Solid weather source for weather-aware features                                            |
| Agmarknet   | Official portal + data.gov.in daily price/arrival dataset (min/max/modal ₹/quintal)                  | Good for market-price features                                                             |

Decisions locked by stakeholders:

1. PostgreSQL + auth → **Neon (raw Postgres)**; auth built in-house (no Supabase coupling).
2. eGramSwaraj → **scrape + alerting** (isolated crawler, drift alerts, snapshot caching).
3. UI language → **bilingual** (Marathi default, English toggle).
4. Platforms → **Android + Web PWA** (iOS deferred to Phase 2).

---

## 2. Feature Feasibility Matrix

Scores: **Feasibility** 1–10 (10 = trivially feasible with available data/tools). **Priority** H/M/L. **Phase**: MVP / Phase 2 / Phase 3 / Reject.

### Governance features

| Feature                               | Feas. | Priority | Phase                               | Dependencies                             | Notes / Better alternative                               |
| ------------------------------------- | ----- | -------- | ----------------------------------- | ---------------------------------------- | -------------------------------------------------------- |
| Panchayat search                      | 9     | H        | MVP                                 | LGD codes, scraped panchayat list        | pg_trgm trigram search; no external search engine needed |
| District → Taluka → Village hierarchy | 10    | H        | MVP                                 | LGD hierarchy tables                     | Static reference data; trivial                           |
| Panchayat profiles                    | 9     | H        | MVP                                 | eGramSwaraj profile scrape               | Sarpanch/secretary/contacts                              |
| Grants                                | 7     | H        | MVP                                 | eGramSwaraj scrape                       | No API → scraping risk; isolate + alert                  |
| Expenditure                           | 7     | H        | MVP                                 | eGramSwaraj scrape                       | Same scraping dependency                                 |
| Scheme-wise spending                  | 7     | H        | MVP                                 | eGramSwaraj scrape                       | Same; denormalized `scheme` column                       |
| Financial charts                      | 9     | M        | MVP                                 | financial data                           | Flutter charts; client-side rendering                    |
| Financial trends                      | 8     | M        | MVP                                 | multi-FY financial data                  | Needs multi-year scrape coverage                         |
| Panchayat comparison                  | 8     | M        | MVP                                 | normalized finance schema                | Compare across peer GPs (same block)                     |
| Public works                          | 7     | M        | MVP                                 | eGramSwaraj works scrape                 | Geo-tagged works; keep images out of MVP if large        |
| Assets                                | 7     | M        | MVP                                 | eGramSwaraj assets scrape                | Maintained by GP; sparse in many states                  |
| Government schemes                    | 9     | M        | MVP                                 | curated catalog (manual + official docs) | Curated static catalog; low maintenance                  |
| Download/share reports                | 9     | M        | MVP                                 | finance/works data                       | Client-side PDF generation                               |
| Offline cache                         | 8     | H        | MVP                                 | Flutter Isar/SQLite                      | Read-only public data → stale-while-revalidate           |
| Grant notifications                   | 7     | M        | Phase 2                             | push infra, ETL timestamps               | Needs reliable update detection from ETL                 |
| Spending anomaly detection            | 6     | M        | Phase 2 (rule-based) → Phase 3 (ML) | finance data + peer stats                | z-score vs block/district mean first                     |

### AI features

| Feature                          | Feas. | Priority | Phase   | Type                 | Notes                                                     |
| -------------------------------- | ----- | -------- | ------- | -------------------- | --------------------------------------------------------- |
| Marathi chatbot                  | 6     | H        | MVP     | LLM + RAG            | Gemini Flash RAG over curated official docs; cite sources |
| Crop disease detection           | 5     | M        | Phase 2 | On-device CV         | TFLite; PlantVillage/IP102 fine-tune; "advisory only"     |
| Pest detection                   | 4     | M        | Phase 2 | On-device CV         | IP102 dataset; lower expected accuracy                    |
| Fertilizer recommendation        | 7     | M        | MVP     | Rule-based           | District soil + crop nutrient DB                          |
| Crop recommendation              | 7     | M        | MVP     | Rule-based           | District agro-climatic + soil + market data               |
| Soil advice                      | 6     | M        | Phase 2 | Rule-based           | District-level soil data; village-level scarce            |
| Weather-aware advice             | 7     | M        | MVP     | Rule-based + IMD API | 3-day forecast triggers for irrigation/spraying           |
| Government scheme recommendation | 8     | M        | MVP     | Rule-based           | Match user profile/location against scheme catalog        |
| Agricultural FAQ                 | 9     | M        | MVP     | Curated + RAG        | Seed with official Kisan/ICAR content                     |
| Seasonal calendar                | 9     | M        | MVP     | Rule-based static    | District-wise sowing/harvest windows                      |
| Market prices                    | 8     | M        | MVP     | API pull             | Agmarknet via data.gov.in; cache daily                    |
| Voice input                      | 6     | M        | Phase 2 | ASR API              | Bhashini/Google Marathi ASR                               |
| Voice output                     | 6     | M        | Phase 2 | TTS API              | Bhashini/Google Marathi TTS                               |

### User features

| Feature            | Feas. | Priority | Phase   | Notes                                         |
| ------------------ | ----- | -------- | ------- | --------------------------------------------- |
| Accounts           | 9     | H        | MVP     | Email OTP via Resend; JWT sessions            |
| Favorites          | 9     | M        | MVP     | Local + server sync                           |
| Saved panchayats   | 9     | M        | MVP     | Same mechanism                                |
| Search history     | 8     | L        | MVP     | Local-first; server optional                  |
| Accessibility      | 9     | H        | MVP     | Text scaling, contrast, TalkBack, WCAG basics |
| Dark mode          | 10    | M        | MVP     | Flutter theming                               |
| Push notifications | 7     | M        | Phase 2 | FCM on Android; web push for PWA              |
| Feedback           | 9     | L        | MVP     | Simple form → Neon table                      |

---

## 3. Architecture Recommendation

```
Flutter (Android + Web PWA)
        │ REST + JWT
        ▼
  Cloudflare Workers (Hono)               GitHub Actions cron
   ├─ /auth/*   email OTP + JWT            └─ ETL pipeline
   ├─ /v1/*     read APIs, cached,         (eGramSwaraj scraper,
   │            rate-limited, AI proxy          data.gov.in, IMD,
   └─ /upload   R2 presigned URLs               Agmarknet)
                        └──────────────┬──────────────┘
                                       ▼
                              Neon Postgres
                        (single DB + connection pooler)
```

- **API**: Hono on Workers. Stateless, compiled to edge runtime, cached reads.
- **Auth**: custom, minimal — `request-otp`, `verify-otp`, `refresh`. OTP hashed (Argon2 via WASM or PBKDF2 via WebCrypto) with expiry + brute-force limits; Ed25519 JWT signing key stored as a Worker secret.
- **Search**: `pg_trgm` `ILIKE` on `village.name` / `panchayat.name` (English + transliterated Marathi). Revisit Typesense/Meilisearch only if search UX degrades at scale.
- **Offline**: Isar (SQLite) cache in app; stale-while-revalidate. Data is public/read-only → no write conflict resolution needed.
- **Caching**: Workers Cache API for hot endpoints; materialized aggregates in Postgres. No Redis.
- **Anomaly detection**: SQL z-score vs district/block mean → later Isolation Forest if warranted.

Why not a Rust backend: the API is thin (proxy + cache + auth). Rust adds build complexity, ops burden, and deployment friction with zero MVP benefit. Rust stays in the toolbox for CPU-heavy Phase-3 work.

---

## 4. Hosting Recommendation

| Criterion            | Cloudflare Workers                 | Rust (Axum)                         | Hybrid  |
| -------------------- | ---------------------------------- | ----------------------------------- | ------- |
| Cost                 | $0–5/mo (free tier)                | VPS/Render $5–50/mo                 | Highest |
| Ops burden           | ~0 (edge, managed, auto-scaling)   | deploys, scaling, runtime security  | High    |
| Latency (India)      | Edge/anycast, near-zero cold start | Region-dependent                    | —       |
| Scalability          | Elastic, huge burst headroom       | Manual or container orchestration   | —       |
| Developer experience | Great for thin APIs                | Great for compute, slower iteration | —       |

**Recommendation by tier:**

- **MVP / 1,000 / 10,000 users**: Cloudflare Workers only.
- **100,000 users**: Still Workers. Read path edge-cached; add Neon connection pooler and read replicas; move ETL to a dedicated runner only if scrape volume demands it.
- **Rust**: revisit only in Phase 3 for compute-heavy processing (anomaly ML, bulk transforms) as a standalone binary/job — not as the main API.

---

## 5. Database Design

Single Neon Postgres database. All schema changes via SQL migrations.

### Reference / hierarchy

- `states` (id, lgd_code, name_mr, name_en)
- `districts` (id, state_id, lgd_code, name_mr, name_en)
- `talukas` (id, district_id, lgd_code, name_mr, name_en)
- `villages` (id, taluka_id, lgd_code, name_mr, name_en, panchayat_id FK)
- `panchayats` (id, state_id, district_id, taluka_id, lgd_code, name_mr, name_en, level, geojson_polygon_id)

### Governance data (all keyed by natural key for idempotent upsert)

- `panchayat_profiles` (panchayat_id, sarpanch_name, secretary_name, contact_phone, elected_committee jsonb, updated_at)
- `grants` (id, panchayat_id, fy, scheme_id, source, amount, disbursed_at, natural_key UNIQUE(panchayat_id, fy, scheme_id))
- `expenditures` (id, panchayat_id, fy, scheme_id, head, amount, natural_key UNIQUE(panchayat_id, fy, scheme_id, head))
- `public_works` (id, panchayat_id, fy, title, status, sanctioned_amount, spent_amount, start_date, end_date, geo_tag jsonb)
- `assets` (id, panchayat_id, category, description, value, status)
- `schemes` (id, code, name_mr, name_en, ministry, description, eligibility jsonb)
- `commodity_prices` (id, district_lgd_code, market, commodity, variety, grade, min_price, max_price, modal_price, price_date, UNIQUE(district_lgd_code, market, commodity, variety, grade, price_date)) — renamed from `market_prices` and keyed by LGD code (not `district_id`) so the natural key stays correct across same-named markets in different districts; `grade` included (see `etl/sources/data_gov_in/README.md`)
- `weather_cache` (district_id, issued_at, forecast jsonb)

### User data

- `users` (id, email, name, locale, created_at)
- `otp_tokens` (id, user_id, hashed_code, channel, expires_at, attempts)
- `sessions` (id, user_id, token_hash, expires_at, revoked)
- `favorites` (user_id, panchayat_id, created_at, PK(user_id, panchayat_id))
- `search_history` (id, user_id, query, created_at)
- `feedback` (id, user_id, category, message, created_at)

### ETL audit

- `ingestion_runs` (id, source, status, rows_seen, rows_upserted, errors jsonb, started_at, finished_at)
- `ingestion_snapshots` (id, source, taken_at, s3_key) — pre-overwrite snapshot cache

### Indexes

- `grants`, `expenditures`, `public_works`: `(panchayat_id, fy)`, `(panchayat_id, scheme_id)`
- `commodity_prices`: `(commodity, price_date)`, `(district_lgd_code, price_date)`
- Names: GiST `pg_trgm` on `panchayats.name_en`, `panchayats.name_mr`, `villages.name_en`
- `users.email` UNIQUE; `sessions.token_hash` UNIQUE

---

## 6. API Design

REST under `/v1`, JSON, versioned. Public read endpoints are unauthenticated but rate-limited and cached; user endpoints require JWT.

### Public read

- `GET /v1/hierarchy` — districts → talukas → villages (cached; large payload, gzip)
- `GET /v1/panchayats?q=&district=&taluka=` — search (pg_trgm)
- `GET /v1/panchayats/{id}` — profile summary
- `GET /v1/panchayats/{id}/finance?fy=` — grants + expenditure (+ scheme breakdown)
- `GET /v1/panchayats/{id}/works?fy=`
- `GET /v1/panchayats/{id}/assets`
- `GET /v1/panchayats/{id}/compare?peer=block|district&fy=`
- `GET /v1/schemes`
- `GET /v1/markets/prices?commodity=&district=&days=`
- `GET /v1/weather?district=` or `?lat=&lng=` — IMD proxy, cached 30 min
- `GET /v1/calendar?district=` — seasonal calendar (static/rule-based)
- `GET /v1/faq`

### AI

- `POST /v1/chat` — Marathi RAG chat (JWT or keyed; token-rationed)
- `POST /v1/advice/crop` / `advice/fertilizer` / `advice/scheme` — rule-based, JSON in/out

### Auth (self-built)

- `POST /v1/auth/request-otp` { email }
- `POST /v1/auth/verify-otp` { email, code } → { access_token, refresh_token }
- `POST /v1/auth/refresh` { refresh_token }
- `POST /v1/auth/logout`

### User (JWT)

- `GET/POST/DELETE /v1/me/favorites`
- `GET /v1/me/search-history`
- `POST /v1/me/feedback`

### Uploads

- `POST /v1/upload/presign` → R2 presigned URL (Phase 2: crop images if a server-side fallback is added)

---

## 7. ETL Design

Purpose: keep a clean, queryable Postgres copy of official open data. All jobs idempotent and auditable.

### Pipelines

| Source                  | Frequency | Method                               | Notes                                 |
| ----------------------- | --------- | ------------------------------------ | ------------------------------------- |
| eGramSwaraj             | Nightly   | HTML crawl of `.do` report endpoints | Isolated scraper module; highest risk |
| data.gov.in / Agmarknet | Daily     | Keyed REST API                       | Market prices, arrivals               |
| IMD                     | Every 3 h | Official REST API                    | Per-Maharashtra-district forecast     |
| Reference (LGD)         | Monthly   | data.gov.in LGD dataset              | Hierarchy + codes                     |

### Pipeline steps (per source)

The shared framework in `etl/` implements orchestration (steps 1–7): fetch with
backoff retry, parse, normalize, validate (dead-letter on rejection),
deduplicate, batched upsert, and `ingestion_runs` audit. Each source supplies
its stage functions and wires them with `createPipeline` (see `etl/README.md`).
Remaining per-source work: snapshot (8) and alerting (9).

1. **Fetch** — retry with exponential backoff; respect robots/ToS; polite rate limit.
2. **Parse** — HTML → structured records (or JSON/CSV for API sources).
3. **Normalize** — standardize names (Marathi + transliterated English), dates, currency, units.
4. **Validate** — schema checks, range checks, required fields; reject invalid batches to dead-letter.
5. **Deduplicate** — natural-key conflict detection; log and keep latest.
6. **Upsert** — single transaction per batch, `ON CONFLICT` update; money tables keyed `(panchayat_id, fy, scheme)`.
7. **Audit** — write `ingestion_runs` row; record row counts.
8. **Snapshot** — before destructive rebuild, store prior snapshot in R2.
9. **Alert** — on failure or **schema drift** (unexpected field/shape) notify via GitHub issue / Telegram webhook.

### Failure recovery

- Retry with backoff → dead-letter file → alert on-mute threshold.
- Full rebuild path: because data is public/regenerable, a corrupt table can be dropped and rebuilt from snapshots or re-scraped.
- No data-loss exposure: no user writes depend on ETL tables.

### Operations

- Runs on GitHub Actions cron (free tier); handoff to a dedicated runner only at high volume.
- `ingestion_runs` dashboard surfaces source health; alert on 3+ consecutive failures.

---

## 8. AI Feasibility Report

No GPU required. No model training for MVP. Lightest practical approach per feature.

| Feature                   | Approach      | Model / Source                                                              | Device vs Server | Latency | Cost                 | Accuracy expectation                                              |
| ------------------------- | ------------- | --------------------------------------------------------------------------- | ---------------- | ------- | -------------------- | ----------------------------------------------------------------- |
| Marathi chatbot           | LLM + RAG     | Gemini 2.0 Flash (or GPT-4o-mini) over curated official docs                | Server           | 1–3 s   | Free tier → few $/mo | Good for curated facts; cite sources; disclaimer                  |
| Crop disease detection    | On-device CV  | TFLite MobileNet fine-tuned on PlantVillage (retrain/additional India data) | Device           | <500 ms | $0                   | 70–90% on training distribution; lower in field → "advisory only" |
| Pest detection            | On-device CV  | TFLite on IP102 subset                                                      | Device           | <500 ms | $0                   | Moderate; constrain to common Maharashtra pests                   |
| Fertilizer recommendation | Rule-based    | District soil + crop nutrient tables                                        | Static           | instant | $0                   | Deterministic                                                     |
| Crop recommendation       | Rule-based    | Agro-climatic zone + soil + market                                          | Static           | instant | $0                   | Deterministic                                                     |
| Soil advice               | Rule-based    | District soil data; village-level scarce                                    | Static           | instant | $0                   | District granularity only                                         |
| Weather-aware advice      | Rule-based    | IMD 3-day forecast + crop rules                                             | Server (cached)  | <200 ms | $0                   | Deterministic triggers                                            |
| Scheme recommendation     | Rule-based    | Scheme catalog + user profile/location                                      | Static           | instant | $0                   | Deterministic                                                     |
| Agricultural FAQ          | Curated + RAG | Official Kisan/ICAR text                                                    | Server           | <2 s    | ~$0                  | High for curated content                                          |
| Seasonal calendar         | Rule-based    | District-wise windows                                                       | Static           | instant | $0                   | Deterministic                                                     |
| Market prices             | API pull      | Agmarknet / data.gov.in                                                     | Server (cached)  | <300 ms | $0                   | High (official data)                                              |
| Voice input               | ASR API       | Bhashini / Google Marathi ASR                                               | Server           | 1–2 s   | near-$0              | Good                                                              |
| Voice output              | TTS API       | Bhashini / Google Marathi TTS                                               | Server           | 1–2 s   | near-$0              | Good                                                              |

Fine-tuning: only for on-device CV (cheap batch training). No server GPU anywhere in the roadmap.

---

## 9. Security Assessment

### Authentication

- Email OTP (no password to lose); OTP hashed at rest, 5-minute expiry, max 5 attempts then lockout, per-IP + per-email rate limits.
- Short-lived access JWT (15 min, Ed25519) + rotating refresh token (stored hashed).

### Authorization

- Row-ownership enforced at query level for user data (`user_id = $jwt.sub`); no cross-user leakage.
- Admin/ETL uses separate service roles with least privilege; public reads use a read-only DB role.

### Application security

- SQL injection: all queries parameterized via SQLx/pg pool on Workers.
- Rate limiting on every public endpoint (Workers `rateLimiting` binding); AI endpoints token-rationed per key.
- API abuse: cache-busting probes mitigated by caching + limits; alerts on 4xx/5xx spikes.

### Secrets

- Worker secrets via `wrangler secret`; GH Actions secrets for ETL keys; no secrets in repos or client code.

### Image upload validation

- Phase 2 uploads: MIME/size allow-list, server-side re-encode; R2 private bucket + presigned URLs; on-device classification first.

### Data / encryption

- TLS in transit (managed). Neon encrypts at rest. No PII beyond email; publish only public government data.

### Backup security

- Neon continuous backups + point-in-time recovery; R2 snapshots of ETL inputs; restore tested quarterly.

---

## 10. Performance Analysis

- **Data size**: ~27k Gram Panchayats, ~35 districts, ~350 talukas in Maharashtra. Hierarchy is small (< 1M rows).
- **Money tables**: ~5–50k rows per financial year per source → single-digit GB after multiple years. Fits managed Postgres trivially.
- **Hot path**: panchayat finance reads → materialized per-FY aggregates + Workers Cache API → p50 < 100 ms.
- **Query complexity**: all hot queries index-backed; comparisons use precomputed peer aggregates (no cross-panchayat scan at read time).
- **Cache strategy**: Cache API (30 min–24 h TTL by endpoint); weather 30 min; prices daily; finance daily (after nightly ETL).
- **No Redis** required. Add only if real-time chat message state is introduced (not planned).
- **DB growth**: ~10–50 MB/month at MVP scale; Neon free tier (512 MB) is ample; branch + pooler handles 100k users.

---

## 11. Cost Analysis (USD/month)

| Tier              | Hosting                   | Database (Neon) | AI                     | Email/Extras     | Monitoring      | Total         |
| ----------------- | ------------------------- | --------------- | ---------------------- | ---------------- | --------------- | ------------- |
| Development / MVP | $0 (Pages + Workers free) | $0 (free tier)  | ~$0 (Gemini free tier) | $0 (Resend free) | $0 (GH + basic) | **~$0**       |
| 1,000 users       | $0–5                      | $0–19           | $2–10                  | $0–5             | $0–5            | **~$5–40**    |
| 10,000 users      | $5–20                     | $19–69          | $10–50                 | $10–20           | $10–20          | **~$45–160**  |
| 100,000 users     | $20–100                   | $69–200         | $50–200                | $30–60           | $30–60          | **~$170–560** |

Notes:

- Cloudflare free tier covers Pages + Workers (100k req/day) for MVP.
- Neon free tier: 0.5 GB storage, 190 compute-hours/mo.
- AI cost dominated by chatbot; on-device CV is $0. Ration chat tokens; cache common answers.
- Resend free tier: 3,000 emails/mo — covers OTP at MVP; upgrade only if needed.

---

## 12. Risk Register

| #   | Risk                                          | Likelihood | Impact | Mitigation                                                                                                                    |
| --- | --------------------------------------------- | ---------- | ------ | ----------------------------------------------------------------------------------------------------------------------------- |
| 1   | eGramSwaraj HTML structure changes break ETL  | High       | High   | Isolated scraper module, schema-drift alerts, snapshot caching, 3-strike alerting; pursue MoPR formal data access as fallback |
| 2   | Government data quality / duplicates          | High       | Medium | Natural-key dedup, validation rules, anomaly flagging, audit logs                                                             |
| 3   | Scraping ToS / legal acceptability            | Medium     | High   | Verify terms; polite low-rate crawling; prefer data.gov.in/MoPR where possible; legal review before launch                    |
| 4   | Marathi LLM inaccuracies                      | Medium     | Medium | RAG over curated official text, cite sources, "informational" disclaimer, offline FAQ fallback                                |
| 5   | On-device CV drift on real farm images        | Medium     | Medium | "Advisory only" labeling, iterate with field data, constrain pest set                                                         |
| 6   | Free-tier limits exceeded at growth           | Low        | Medium | Documented tier-migration path (see Cost + Scaling)                                                                           |
| 7   | Push notification dependence on ETL freshness | Medium     | Low    | Notification only for detected deltas; guard against false-positive spam                                                      |
| 8   | Small-team bus factor                         | Medium     | Medium | Monorepo, conventional commits, migrations as code, CI from day one                                                           |

---

## 13. MVP Definition (Phase 1 — 12–18 months)

Must ship:

- Bilingual (Marathi default / English) UI — Android + Web PWA
- District → Taluka → Village hierarchy + panchayat search
- Panchayat profiles, grants, expenditure, scheme-wise spending
- Financial charts, trends, panchayat comparison
- Public works + assets lists
- Government scheme catalog (curated)
- Download/share reports, offline cache
- Accounts (email OTP), favorites, saved panchayats, search history
- Dark mode, accessibility (text scaling, contrast, TalkBack), feedback
- Marathi chatbot (RAG), market prices, weather-aware advice, crop + fertilizer recommendation (rule-based), seasonal calendar, agricultural FAQ
- Full ETL pipeline (eGramSwaraj, data.gov.in, IMD, Agmarknet) + `ingestion_runs` dashboard + alerting

Explicitly **not** in MVP: crop/pest detection, voice, anomaly alerts, push notifications, iOS.

---

## 14. Phase 2 Roadmap (6–9 months)

- Crop disease + pest detection (on-device TFLite; "advisory only")
- Soil advice (rule-based, district granularity)
- Voice input / output (Bhashini / Google Marathi ASR + TTS)
- Spending anomaly alerts (rule-based z-score vs peer GPs)
- Push notifications (FCM Android + web push PWA)
- Grant notifications (driven by ETL deltas)
- iOS build (requires Apple Developer account + CI mac runners)

---

## 15. Phase 3 Roadmap

- ML anomaly detection (Isolation Forest / time-series) on server or on-device
- Deeper soil + weather integration (village-level where data exists)
- On-device Marathi ASR/TTS for full offline voice
- Optional dedicated Rust ETL/compute worker if volume demands
- Typesense/Meilisearch if search UX degrades

---

## 16. Features to Postpone

| Feature                           | Reason                                                                      |
| --------------------------------- | --------------------------------------------------------------------------- |
| iOS app                           | $99/yr + extra CI; rural Android-first reach; defer to Phase 2              |
| Voice input/output                | External ASR/TTS adds cost + latency; defer to Phase 2                      |
| Push notifications                | ETL delta detection not mature at MVP; defer to Phase 2                     |
| Crop/pest detection               | Dataset drift + accuracy; needs on-device model iteration; defer to Phase 2 |
| ML anomaly detection              | Rule-based z-score sufficient first; defer to Phase 3                       |
| Real-time transaction streaming   | No demand; costly; defer indefinitely                                       |
| Complex GIS (Gram Manchitra maps) | Data + rendering complexity; defer                                          |

---

## 17. Features to Reject

| Feature                                    | Reason                                   |
| ------------------------------------------ | ---------------------------------------- |
| Training/fine-tuning large custom LLMs     | Cost >> value; managed LLMs suffice      |
| Per-farmer personalized risk scoring       | Data liability + accuracy risk           |
| Integration with undocumented private APIs | Against project principles               |
| Self-hosted ML inference clusters          | Ops burden + cost; no GPU need           |
| Blockchain-based transparency ledger       | No user value; adds complexity           |
| Real-time chat / messaging                 | Not core; adds state + moderation burden |

---

## 18. Testing Strategy

- **Unit**: Rust (if any), TypeScript (Workers/Hono), Dart (Flutter) — focused, fast.
- **Flutter**: widget + golden tests; bilingual localization coverage; accessibility snapshot tests.
- **ETL**: fixture-based snapshot tests per source; schema-drift tests (canned "old/new" HTML); idempotency test (run twice → same result).
- **API**: contract tests against a sandbox Neon DB; rate-limit tests; auth/OTP flow tests.
- **Integration**: nightly CI run of ETL against a staging DB with seeded fixtures.
- **Manual device matrix**: Android (API 26–current, low-RAM device), Web (Chrome, Safari), offline mode on airplane.
- **Load**: k6-style smoke on Workers API at 1k/10k RPS target; verify caching holds.

---

## 19. Deployment Strategy

- **Frontend**: Flutter build → Android artifact (Play release track) + Web build → Cloudflare Pages.
- **API**: Workers via `wrangler deploy`; environment-separated (dev/staging/prod) Worker names.
- **DB**: SQL migrations as code (sqlx/migrate or `drizzle`); auto-run on deploy; Neon branching for previews.
- **CI/CD**: GitHub Actions — lint + test + typecheck on PR; deploy on merge to main; canary/staged rollout for Workers.
- **Feature flags**: server-side flags in Worker KV/Env; kill-switch for AI endpoints.
- **Observability**: Workers `logpush` + Neon logs; structured logs; error budgets.

---

## 20. Scaling Strategy

- **Read path**: edge-cached on Workers → near-zero origin load for popular panchayats.
- **Database**: Neon connection pooler + read replicas at 10k+; materialized aggregates keep hot queries cheap.
- **ETL**: move from GitHub Actions cron to a dedicated runner/Worker Cron Trigger at high volume.
- **AI**: token rationing + answer caching; batch non-urgent LLM calls; no GPU ever required.
- **Team**: monorepo, migrations-as-code, one deploy pipeline — a 2–3 person team can operate through 100k users.

---

## 21. Final Recommendations

1. **Ship Android + Web PWA on Cloudflare Pages; skip iOS in MVP.**
2. **API on Cloudflare Workers (Hono) — no Rust backend.**
3. **Neon Postgres + self-built email-OTP auth; R2 for storage.**
4. **Invest engineering time in the eGramSwaraj scraper and its alerting — it is the project's heart and its biggest risk.**
5. **Use only official open data; scrape politely and legally; verify ToS.**
6. **Light AI: managed LLM RAG + on-device CV + rule-based recommendations. Zero GPU.**
7. **Start rule-based anomaly detection; upgrade to ML only if users act on it.**
8. **Make offline + bilingual + accessibility first-class from day one — they define the rural user base.**
9. **Enforce the free-tier cost envelope for MVP; growth path is documented and incremental.**
10. **Keep a 12–24 month cadence: MVP in 12–18 months, Phase 2 in 6–9 more.**

---

_Document generated from `prompt.txt` planning brief. Approved for architecture; implementation to follow in separate milestones._
