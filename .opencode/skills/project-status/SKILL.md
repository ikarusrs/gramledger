---
name: project-status
description: Check the status of current project processes, crawlers, workers, servers, and long-running jobs when the user asks for status, progress, health, or whether a run is done.
---

# Project Status

Use this skill for status requests only. Keep checks read-only unless the user
explicitly asks to restart, repair, or change a process.

## Workflow

1. Identify active work from the current conversation, project scripts,
   process table, recent logs, and relevant local service endpoints.
2. Check the process ID or command, then inspect the latest useful log lines.
3. Check project-specific progress indicators such as completion markers,
   queue counts, database row counts, ingestion runs, or health endpoints.
4. Distinguish running, completed, failed, stalled, and not-started states.
5. Report only the processes relevant to the user's request. Do not restart or
   mutate anything while answering a status request.

## Reporting

Use a concise status-first response:

- State: `RUNNING`, `COMPLETED`, `FAILED`, `STALLED`, or `NOT RUNNING`.
- Progress: completed/total, rows, queue, elapsed time, or other concrete
  counters when available.
- Latest failure or blocker, if any.
- Log path or PID only when useful for follow-up.

Do not call a job successful merely because its process exited. Verify its
output or completion markers. If a process is running but producing no recent
progress, call it `STALLED` and include the evidence.

## Gramledger Hints

- For the Maharashtra eGramSwaraj crawl, inspect the driver PID and
  `/tmp/opencode/egs-district-retry.log` or the current district-run log.
- Count `/tmp/opencode/egs-districts/*.ok` markers and compare with the
  discovered work-item count.
- Check `financial_statements`, `scheme_expenditures`, and `ingestion_runs`
  using the local test database when the ETL is the relevant process.
- Treat successful ETL runs with `rows_upserted=0` and all rows skipped as
  incomplete data, not as a successful load.
