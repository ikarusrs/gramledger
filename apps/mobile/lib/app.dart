import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/config/app_config.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';
import 'core/theme/theme_mode_controller.dart';
import 'l10n/app_localizations.dart';

/// Root application widget.
///
/// Wires localization, theming (incl. dark mode), routing, and state management
/// scaffolding together. Feature screens are registered in [appRouter].
class GramLedgerApp extends ConsumerWidget {
  const GramLedgerApp({super.key});

  /// Resolves the startup locale. `DEFAULT_LOCALE=system` defers to the device
  /// locale; otherwise the configured locale (Marathi by default) is forced.
  Locale? get _startupLocale {
    final code = AppConfig.instance.defaultLocale;
    return code == 'system' ? null : Locale(code);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeMode = ref.watch(themeModeControllerProvider);

    return MaterialApp.router(
      title: 'GramLedger',
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: themeMode,
      routerConfig: appRouter,
      locale: _startupLocale,
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
    );
  }
}
