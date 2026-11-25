import 'package:flutter/material.dart';

/// The app's one theme.
///
/// The font pair is the point. Names, business names, positions, trades and
/// every geography row come back in English and Tamil, and the two scripts sit
/// in the same paragraph -- often the same line.
///
/// `NotoSansTamil` carries NO Latin glyphs. Setting it as `fontFamily` renders
/// `TN72001` as empty boxes, which is exactly the trap the backend's PDF
/// renderer already hit. So `NotoSans` is the family and Tamil is the
/// FALLBACK: Flutter walks the fallback list per-glyph, so Latin resolves from
/// the first family and Tamil from the second with no per-run font selection
/// needed here.
class AppTheme {
  const AppTheme._();

  static const fontFamily = 'NotoSans';
  static const fontFamilyFallback = <String>['NotoSansTamil'];

  static const seed = Color(0xFF1D4ED8);

  static ThemeData light() => _build(Brightness.light);
  static ThemeData dark() => _build(Brightness.dark);

  static ThemeData _build(Brightness brightness) {
    final scheme = ColorScheme.fromSeed(
      seedColor: seed,
      brightness: brightness,
    );
    final base = ThemeData(colorScheme: scheme, useMaterial3: true);

    return base.copyWith(
      textTheme: base.textTheme.apply(
        fontFamily: fontFamily,
        fontFamilyFallback: fontFamilyFallback,
      ),
      primaryTextTheme: base.primaryTextTheme.apply(
        fontFamily: fontFamily,
        fontFamilyFallback: fontFamilyFallback,
      ),
      inputDecorationTheme: const InputDecorationTheme(
        border: OutlineInputBorder(),
        isDense: true,
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(48),
          textStyle: const TextStyle(
            fontFamily: fontFamily,
            fontFamilyFallback: fontFamilyFallback,
            fontWeight: FontWeight.w700,
            fontSize: 16,
          ),
        ),
      ),
      snackBarTheme: base.snackBarTheme.copyWith(
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
}
