import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/app_router.dart';
import '../../l10n/app_localizations.dart';

/// Placeholder home screen. No features implemented yet.
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  static const Key homeScreenKey = Key('home_screen');

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      key: homeScreenKey,
      appBar: AppBar(title: Text(l10n.appTitle)),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.account_balance, size: 64),
            const SizedBox(height: 16),
            Text(
              l10n.homeTitle,
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 8),
            Text(
              l10n.homeSubtitle,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 24),
            FilledButton.tonal(
              onPressed: () => context.go(AppRoutes.settings),
              child: Text(l10n.openSettings),
            ),
          ],
        ),
      ),
    );
  }
}
