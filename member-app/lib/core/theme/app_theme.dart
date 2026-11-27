import 'package:flutter/material.dart';

/// The console's design system, ported.
///
/// The values below are not chosen here - they are read off
/// `console/src/app/globals.css`, so the app and the website are the same
/// product rather than two things that happen to be blue. An explicit
/// `ColorScheme` rather than `ColorScheme.fromSeed`: a seed GENERATES a
/// palette, and what is wanted is a specific one.
class AppColors {
  const AppColors._();

  // --primary / --primary-foreground, the same in both themes.
  static const primary = Color(0xFF4F46E5); // Indigo
  static const primaryHover = Color(0xFF4338CA);
  static const onPrimary = Color(0xFFFFFFFF);

  /// --info. The far end of the header gradient.
  static const info = Color(0xFF0EA5E9); // Sky

  // Light: --background / --card / --foreground / --muted-foreground / --border
  static const lightBackground = Color(0xFFF4F6FB);
  static const lightCard = Color(0xFFFFFFFF);
  static const lightForeground = Color(0xFF0F172A);
  static const lightMutedForeground = Color(0xFF64748B);
  static const lightBorder = Color(0xFFE2E8F0);
  static const lightMuted = Color(0xFFF1F5F9);

  // Dark.
  static const darkBackground = Color(0xFF0B0F19);
  static const darkCard = Color(0xFF151B2B);
  static const darkForeground = Color(0xFFE2E8F0);
  static const darkMutedForeground = Color(0xFF94A3B8);
  static const darkBorder = Color(0xFF1F2A3D);

  // Semantic. Identical in both themes, as in globals.css.
  static const success = Color(0xFF16A34A);
  static const warning = Color(0xFFD97706);
  static const destructive = Color(0xFFDC2626);

  /// --gradient-header, used on the splash and the profile band.
  static const headerGradient = LinearGradient(
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
    colors: [primary, info],
  );
}

/// Success, warning and info, which a Material `ColorScheme` has no slot for.
///
/// A ThemeExtension rather than loose constants so a widget reads them from
/// the theme and dark mode resolves itself - the same reason every other
/// colour here comes from the scheme.
@immutable
class AppStatusColors extends ThemeExtension<AppStatusColors> {
  const AppStatusColors({
    required this.success,
    required this.warning,
    required this.info,
    required this.onStatus,
  });

  final Color success;
  final Color warning;
  final Color info;

  /// Foreground for all three. White in both themes, as in globals.css.
  final Color onStatus;

  static const _shared = AppStatusColors(
    success: AppColors.success,
    warning: AppColors.warning,
    info: AppColors.info,
    onStatus: Color(0xFFFFFFFF),
  );

  @override
  AppStatusColors copyWith({
    Color? success,
    Color? warning,
    Color? info,
    Color? onStatus,
  }) => AppStatusColors(
    success: success ?? this.success,
    warning: warning ?? this.warning,
    info: info ?? this.info,
    onStatus: onStatus ?? this.onStatus,
  );

  @override
  AppStatusColors lerp(AppStatusColors? other, double t) {
    if (other == null) return this;
    return AppStatusColors(
      success: Color.lerp(success, other.success, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
      info: Color.lerp(info, other.info, t)!,
      onStatus: Color.lerp(onStatus, other.onStatus, t)!,
    );
  }

  /// Reads the extension, falling back rather than throwing.
  ///
  /// A widget used outside this theme - a test harness, a preview - should
  /// render in the right colours rather than crash on a null.
  static AppStatusColors of(BuildContext context) =>
      Theme.of(context).extension<AppStatusColors>() ?? _shared;
}

class AppTheme {
  const AppTheme._();

  static const fontFamily = 'NotoSans';

  /// `NotoSansTamil` carries NO Latin glyphs, so it must be the FALLBACK and
  /// never the family: as the family it renders `TN72001` as empty boxes,
  /// which is exactly the trap the backend's PDF renderer hit once already.
  /// Flutter walks this list per-glyph, so Latin resolves from NotoSans and
  /// Tamil from here with no per-run font selection anywhere.
  static const fontFamilyFallback = <String>['NotoSansTamil'];

  /// --radius: 0.5rem.
  static const radius = 8.0;

  /// `const`, not `final`: widgets put this inside `const BoxDecoration`,
  /// which `BorderRadius.circular` - a factory - cannot satisfy.
  static const borderRadius = BorderRadius.all(Radius.circular(radius));

  static ThemeData light() => _build(Brightness.light);
  static ThemeData dark() => _build(Brightness.dark);

  static ThemeData _build(Brightness brightness) {
    final isDark = brightness == Brightness.dark;

    final scheme = ColorScheme(
      brightness: brightness,
      primary: AppColors.primary,
      onPrimary: AppColors.onPrimary,
      primaryContainer: isDark
          ? const Color(0xFF312E81)
          : const Color(0xFFE0E7FF),
      onPrimaryContainer: isDark
          ? const Color(0xFFE0E7FF)
          : const Color(0xFF312E81),
      secondary: AppColors.info,
      onSecondary: Colors.white,
      error: AppColors.destructive,
      onError: Colors.white,
      errorContainer: isDark
          ? const Color(0xFF450A0A)
          : const Color(0xFFFEE2E2),
      onErrorContainer: isDark
          ? const Color(0xFFFECACA)
          : const Color(0xFF7F1D1D),
      // --background. Flutter paints scaffolds and sheets from `surface`.
      surface: isDark ? AppColors.darkBackground : AppColors.lightBackground,
      onSurface: isDark ? AppColors.darkForeground : AppColors.lightForeground,
      // --card, which is what sits ON the background.
      surfaceContainerLowest: isDark ? AppColors.darkCard : AppColors.lightCard,
      surfaceContainerLow: isDark ? AppColors.darkCard : AppColors.lightCard,
      surfaceContainer: isDark ? AppColors.darkCard : AppColors.lightMuted,
      surfaceContainerHigh: isDark
          ? const Color(0xFF1F2A3D)
          : AppColors.lightMuted,
      surfaceContainerHighest: isDark
          ? const Color(0xFF1F2A3D)
          : AppColors.lightMuted,
      // --muted-foreground, for every secondary line in the app.
      onSurfaceVariant: isDark
          ? AppColors.darkMutedForeground
          : AppColors.lightMutedForeground,
      // --border.
      outline: isDark ? AppColors.darkBorder : AppColors.lightBorder,
      outlineVariant: isDark ? AppColors.darkBorder : AppColors.lightBorder,
      shadow: Colors.black,
      scrim: Colors.black,
      inverseSurface: isDark
          ? AppColors.lightForeground
          : AppColors.darkBackground,
      onInverseSurface: isDark
          ? AppColors.lightForeground
          : AppColors.darkForeground,
      inversePrimary: AppColors.primaryHover,
    );

    final base = ThemeData(colorScheme: scheme, useMaterial3: true);
    final border = isDark ? AppColors.darkBorder : AppColors.lightBorder;

    return base.copyWith(
      scaffoldBackgroundColor: scheme.surface,
      dividerColor: border,
      extensions: const [AppStatusColors._shared],

      textTheme: base.textTheme.apply(
        fontFamily: fontFamily,
        fontFamilyFallback: fontFamilyFallback,
      ),
      primaryTextTheme: base.primaryTextTheme.apply(
        fontFamily: fontFamily,
        fontFamilyFallback: fontFamilyFallback,
      ),

      appBarTheme: AppBarTheme(
        backgroundColor: scheme.surfaceContainerLowest,
        foregroundColor: scheme.onSurface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        shape: Border(bottom: BorderSide(color: border)),
        titleTextStyle: TextStyle(
          fontFamily: fontFamily,
          fontFamilyFallback: fontFamilyFallback,
          color: scheme.onSurface,
          fontSize: 17,
          fontWeight: FontWeight.w600,
        ),
      ),

      // --shadow-card, as a flat bordered card rather than a Material
      // elevation: the console's cards are a 1px border and a whisper of
      // shadow, and Material's default elevation tint is neither.
      cardTheme: CardThemeData(
        color: scheme.surfaceContainerLowest,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: borderRadius,
          side: BorderSide(color: border),
        ),
      ),

      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: scheme.surfaceContainerLowest,
        isDense: true,
        // Both default to ONE line and ellipsize. Set here rather than per
        // field: the Aadhaar helper ("Stored encrypted. Only the last four
        // digits are ever shown.") lost its second half on a phone, and a
        // truncated explanation of what happens to an identity number is
        // worse than none.
        helperMaxLines: 3,
        errorMaxLines: 3,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 12,
          vertical: 14,
        ),
        border: OutlineInputBorder(
          borderRadius: borderRadius,
          borderSide: BorderSide(color: border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: borderRadius,
          borderSide: BorderSide(color: border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: borderRadius,
          // --ring is --primary.
          borderSide: const BorderSide(color: AppColors.primary, width: 1.6),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: borderRadius,
          borderSide: const BorderSide(color: AppColors.destructive),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: borderRadius,
          borderSide: const BorderSide(
            color: AppColors.destructive,
            width: 1.6,
          ),
        ),
        hintStyle: TextStyle(color: scheme.onSurfaceVariant),
      ),

      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(50),
          shape: RoundedRectangleBorder(borderRadius: borderRadius),
          textStyle: const TextStyle(
            fontFamily: fontFamily,
            fontFamilyFallback: fontFamilyFallback,
            fontWeight: FontWeight.w600,
            fontSize: 16,
          ),
        ),
      ),

      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(50),
          side: BorderSide(color: border),
          foregroundColor: scheme.onSurface,
          shape: RoundedRectangleBorder(borderRadius: borderRadius),
          textStyle: const TextStyle(
            fontFamily: fontFamily,
            fontFamilyFallback: fontFamilyFallback,
            fontWeight: FontWeight.w600,
            fontSize: 15,
          ),
        ),
      ),

      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: borderRadius),
      ),

      dialogTheme: DialogThemeData(
        backgroundColor: scheme.surfaceContainerLowest,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),

      chipTheme: base.chipTheme.copyWith(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(6),
          side: BorderSide(color: border),
        ),
      ),

      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: AppColors.primary,
      ),
    );
  }
}
