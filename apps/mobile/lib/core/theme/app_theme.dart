import 'package:flutter/material.dart';

/// Central theme definition.
///
/// Material 3 with a green seed (agriculture/rural identity) and a bundled
/// Devanagari font so Marathi renders consistently on low-end Android devices.
abstract final class AppTheme {
  static const Color _seed = Color(0xFF2E7D32);

  static final ThemeData light = _build(Brightness.light);
  static final ThemeData dark = _build(Brightness.dark);

  static ThemeData _build(Brightness brightness) {
    final colorScheme = ColorScheme.fromSeed(
      seedColor: _seed,
      brightness: brightness,
    );
    final base = ThemeData(colorScheme: colorScheme, useMaterial3: true);
    return base.copyWith(
      textTheme: base.textTheme.apply(
        fontFamily: 'Mukta',
        bodyColor: colorScheme.onSurface,
        displayColor: colorScheme.onSurface,
      ),
    );
  }
}
