import 'package:go_router/go_router.dart';

import '../../features/home/home_screen.dart';
import '../../features/settings/settings_screen.dart';

/// Route path constants (centralized to avoid magic strings).
abstract final class AppRoutes {
  static const String home = '/';
  static const String settings = '/settings';
}

/// Application routing skeleton (go_router).
///
/// Feature screens are mounted here. Add feature branches under these paths as
/// screens land; use sub-routes or StatefulShellRoute once tabbed navigation
/// is introduced.
final GoRouter appRouter = GoRouter(
  initialLocation: AppRoutes.home,
  routes: [
    GoRoute(
      path: AppRoutes.home,
      builder: (context, state) => const HomeScreen(),
    ),
    GoRoute(
      path: AppRoutes.settings,
      builder: (context, state) => const SettingsScreen(),
    ),
  ],
);
