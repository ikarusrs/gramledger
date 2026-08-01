# Development

This document explains how to set up, run, and work on GramLedger locally.

## Prerequisites

| Tool        | Version                      | Purpose                                      |
| ----------- | ---------------------------- | -------------------------------------------- |
| Flutter SDK | 3.44.x (stable), Dart 3.12.x | Mobile app (`apps/mobile`)                   |
| Node.js     | >= 20                        | TypeScript projects (`apps/api`, `database`) |
| npm         | 9+                           | Workspace tooling                            |
| git         | any                          | Version control                              |

PostgreSQL itself is **not** required locally — the database package connects to
Neon over the network (see below). For local-only work you may point
`DATABASE_URL` at any Postgres instance.

## Quick start

```bash
git clone <repo-url> gramledger
cd gramledger
npm run setup
```

`npm run setup` installs npm dependencies, runs `flutter pub get`, installs git
hooks (`.githooks/`), and copies `.env.example`/`.dev.vars.example` files.

> Note: this repo was bootstrapped with Flutter 3.44.8 / Dart 3.12.2. If your
> Flutter SDK is much older/newer, `flutter pub get` may report version
> conflicts — align your SDK (or run `flutter pub outdated`).

## Commands

| Command                            | What it does                                           |
| ---------------------------------- | ------------------------------------------------------ |
| `npm run setup`                    | Install deps + git hooks + env files                   |
| `npm run dev:api`                  | Run the API with `wrangler dev` (hot reload)           |
| `npm run lint`                     | ESLint (api) + `flutter analyze` (mobile)              |
| `npm run lint:fix`                 | Same, auto-fixing ESLint issues                        |
| `npm run format`                   | Prettier + `dart format` (write)                       |
| `npm run format:check`             | Same, but only verify                                  |
| `npm run test`                     | Vitest (api) + `flutter test` (mobile)                 |
| `npm run build`                    | Type-check (api) + `flutter build web` (mobile)        |
| `npm run clean`                    | Remove build artifacts                                 |
| `npm run clean -- --full`          | Also remove `node_modules`, `.dart_tool`               |
| `npm run db:migrate`               | Apply DB migrations                                    |
| `npm run db:migrate:create -- <x>` | Scaffold a new migration                               |
| `npm run db:migrate:down`          | Roll back the last migration                           |
| `npm run db:migrate:test`          | Apply migrations to the test DB (`database/.env.test`) |
| `npm run db:seed`                  | Apply seed data                                        |

### Running the mobile app

```bash
cd apps/mobile
flutter run -d chrome          # Web (PWA)
flutter run -d <android-device>  # Android device/emulator
```

### Running the API

```bash
npm run dev:api
# -> http://localhost:8787/health
```

## Configuration

### Mobile (`apps/mobile`)

Runtime config is injected at **compile time** via `--dart-define` (see
`lib/core/config/app_config.dart`):

```bash
flutter run \
  --dart-define=API_BASE_URL=https://api.gramledger.in \
  --dart-define=ENVIRONMENT=production
```

Defaults (used when flags are omitted): `API_BASE_URL=http://localhost:8787`,
`ENVIRONMENT=development`, `DEFAULT_LOCALE=mr`.

### API (`apps/api`)

- Non-secret config: `wrangler.toml` → `[vars]`.
- Local overrides/secrets: `apps/api/.dev.vars` (gitignored; template:
  `.dev.vars.example`). `wrangler dev` picks it up automatically.
- Production secrets: `wrangler secret put <KEY>`.

### Database (`database`)

- Connection string: `DATABASE_URL` in `database/.env` (gitignored; template:
  `.env.example`). Create a Neon project (or use a local Postgres) and paste the
  pooled URL.
- Test database: `DATABASE_URL` in `database/.env.test` (gitignored; template:
  `.env.test.example`) — used by `npm run db:migrate:test`. Point it at a
  scratch database; never your dev/prod DB.
- Full schema reference, ER diagram, and indexing strategy:
  [database/README.md](database/README.md).

## Localization

ARB source files live in `apps/mobile/lib/l10n/` (`app_en.arb`, `app_mr.arb`).

- Edit the ARB files, then run `flutter gen-l10n` (also runs automatically on
  `flutter pub get`).
- Generated Dart lives alongside the ARB files; **do not edit generated files**.
- Marathi is the default locale; a device-locale fallback (`DEFAULT_LOCALE=system`)
  is supported.

## Testing

- **API**: `apps/api/test/` (Vitest). Drive the app with `buildApp().request(...)` —
  no network needed.
- **Mobile**: `apps/mobile/test/` (widget tests via `flutter test`).
- **Database**: migrations are SQL; verify with `npm run db:migrate` against a
  scratch database. ETL tests will come with the ETL package.

## Repository hygiene

- Pre-commit hook runs Prettier/`dart format` checks on staged files. Skip with
  `git commit --no-verify` only when necessary (CI still verifies).
- Branch and commit conventions are in [CONTRIBUTING.md](CONTRIBUTING.md).

## Troubleshooting

- **`flutter` not found**: ensure Flutter is on your `PATH`, then re-run
  `npm run setup`.
- **Port 8787 busy**: `wrangler dev` uses 8787; override with
  `npm run dev:api -- --port 8790` and update `API_BASE_URL` accordingly.
- **Localization changes not visible**: run `flutter gen-l10n` and restart the
  app (web hot-reload may miss generated files).
