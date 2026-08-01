# Shared packages (monorepo convention)

This directory is reserved for code shared by more than one project.

**Current state:** empty by design.

Between `apps/api` (TypeScript) and `apps/mobile` (Dart) there is no shared
runtime code yet, so creating packages here would be premature abstraction
(see PLANNING.md — "avoid premature abstractions").

## When to add a package

Add a package under `packages/<name>` (and register it in the root
`package.json` workspaces) only when:

- at least **two** consumers actually need it, and
- it is not a one-liner (a one-liner should be duplicated or inlined), and
- it is stable enough that changing it won't churn both consumers.

Candidate examples that may emerge later:

- `packages/contracts` — shared TypeScript request/response types + Zod schemas
  used by both `apps/api` and the future `etl` project (also used to drive the
  Dart API client generation).
- `packages/eslint-config` — if TypeScript config diverges between projects.

Language note: Dart code shared by `apps/mobile` should live as a local package
under `apps/mobile/packages/` or be extracted to a separate Flutter package when
it is actually needed — not here.
