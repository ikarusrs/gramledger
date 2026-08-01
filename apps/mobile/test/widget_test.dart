import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:gramledger/app.dart';
import 'package:gramledger/features/home/home_screen.dart';
import 'package:gramledger/features/settings/settings_screen.dart';

void main() {
  testWidgets('renders the home screen on startup', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: GramLedgerApp()));
    await tester.pumpAndSettle();

    expect(find.byKey(HomeScreen.homeScreenKey), findsOneWidget);
  });

  testWidgets('navigates from home to settings and back', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: GramLedgerApp()));
    await tester.pumpAndSettle();

    await tester.tap(find.text('सेटिंग्ज उघडा'));
    await tester.pumpAndSettle();

    expect(find.byKey(SettingsScreen.settingsScreenKey), findsOneWidget);
  });
}
