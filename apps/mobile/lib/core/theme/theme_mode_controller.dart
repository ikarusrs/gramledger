import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// App-wide theme mode state (state management scaffolding).
///
/// Consumed by the root `MaterialApp` and mutated from the settings screen.
/// Replace this with persistence (e.g. shared_preferences) when real features
/// arrive.
class ThemeModeController extends Notifier<ThemeMode> {
  @override
  ThemeMode build() => ThemeMode.system;

  void set(ThemeMode mode) => state = mode;

  void toggle() {
    state = switch (state) {
      ThemeMode.system || ThemeMode.light => ThemeMode.dark,
      ThemeMode.dark => ThemeMode.light,
    };
  }
}

final themeModeControllerProvider =
    NotifierProvider<ThemeModeController, ThemeMode>(ThemeModeController.new);
