/// Compile-time application configuration.
///
/// Values are injected via `--dart-define` (see DEVELOPMENT.md):
///
/// ```bash
/// flutter run --dart-define=API_BASE_URL=https://api.gramledger.in \
///             --dart-define=ENVIRONMENT=production
/// ```
///
/// All values have safe development defaults so the app builds and runs
/// without any flags.
class AppConfig {
  const AppConfig._({
    required this.environment,
    required this.apiBaseUrl,
    required this.defaultLocale,
  });

  static const AppConfig instance = AppConfig._(
    environment: String.fromEnvironment(
      'ENVIRONMENT',
      defaultValue: 'development',
    ),
    apiBaseUrl: String.fromEnvironment(
      'API_BASE_URL',
      defaultValue: 'http://localhost:8787',
    ),
    defaultLocale: String.fromEnvironment('DEFAULT_LOCALE', defaultValue: 'mr'),
  );

  /// `development`, `staging`, or `production`.
  final String environment;

  /// Base URL of the GramLedger API.
  final String apiBaseUrl;

  /// Default app locale (`mr` = Marathi-first). Use `system` to follow the
  /// device locale instead.
  final String defaultLocale;

  bool get isProduction => environment == 'production';
}
