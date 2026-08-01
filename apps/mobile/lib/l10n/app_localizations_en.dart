// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appTitle => 'GramLedger';

  @override
  String get appTagline => 'Panchayat transparency & farmer assistance';

  @override
  String get homeTitle => 'Home';

  @override
  String get homeSubtitle => 'Explore Maharashtra\'s panchayats';

  @override
  String get settingsTitle => 'Settings';

  @override
  String get settingsAppearance => 'Appearance';

  @override
  String get settingsThemeMode => 'Theme';

  @override
  String get settingsThemeLight => 'Light';

  @override
  String get settingsThemeDark => 'Dark';

  @override
  String get settingsThemeSystem => 'System';

  @override
  String get settingsLanguage => 'Language';

  @override
  String get settingsLanguageMr => 'मराठी';

  @override
  String get settingsLanguageEn => 'English';

  @override
  String get openSettings => 'Open settings';

  @override
  String get backToHome => 'Back to home';
}
