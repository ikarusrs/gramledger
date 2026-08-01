# ETL (not yet implemented)

Planned home of the ingestion pipelines that keep the PostgreSQL database in
sync with official open data (see PLANNING.md §7):

| Source                  | Method                               | Frequency |
| ----------------------- | ------------------------------------ | --------- |
| eGramSwaraj             | HTML crawl of `.do` report endpoints | Nightly   |
| data.gov.in / Agmarknet | Keyed REST API                       | Daily     |
| IMD                     | Official REST API                    | Every 3 h |
| LGD reference data      | data.gov.in dataset                  | Monthly   |

**Status:** placeholder only. No code exists yet.

Pipeline steps to implement later: fetch → parse → normalize → validate →
deduplicate → idempotent upsert → audit (`ingestion_runs`) → snapshot → alert.

When implemented, this directory will be a TypeScript/Node workspace project
(`@gramledger/etl`) added to the root `package.json` workspaces, scheduled via
GitHub Actions cron.

Design constraint: the eGramSwaraj scraper is the project's **highest-risk
component** — it must be isolated, resilient, and alert on schema drift.
