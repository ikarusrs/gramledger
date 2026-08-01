# GramLedger — Mobile (Flutter)

The GramLedger Flutter application for **Android** and **Web (PWA)**. Marathi-first
and bilingual, with offline-first ambitions (see the repo root
[PLANNING.md](../../docs/PLANNING.md) and [DEVELOPMENT.md](../../DEVELOPMENT.md)).

## Structure

```
lib/
├── main.dart                      # entry point (ProviderScope)
├── app.dart                       # root widget: theme + l10n + router
├── core/
│   ├── config/app_config.dart     # --dart-define configuration
│   ├── router/app_router.dart     # go_router skeleton
│   ├── theme/                     # Material 3 themes + theme mode state
├── features/                      # feature-first modules (placeholders only)
│   ├── home/
│   └── settings/
└── l10n/                          # ARB sources + generated localizations
```

## Run

```bash
flutter pub get
flutter run -d chrome          # Web (PWA)
flutter run -d <device>        # Android
```

Config is injected at compile time via `--dart-define` (see
[DEVELOPMENT.md](../../DEVELOPMENT.md#configuration)).

## Codegen

`flutter gen-l10n` regenerates `lib/l10n/app_localizations*.dart` from the ARB
files. Generated files are committed; edit only the `.arb` sources.

## Quality gates

```bash
flutter analyze
flutter test
dart format --set-exit-if-changed lib test
```
