import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'core/config/env.dart';
import 'core/storage/settings_store.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/member_session.dart';
import 'features/language/ui/language_screen.dart';
import 'features/splash/ui/splash_screen.dart';
import 'l10n/app_localizations.dart';

/// The two languages this app speaks.
///
/// Declared here rather than inferred from the generated delegate, because
/// the language screen has to list them before any localisation is loaded.
const supportedLanguages = <Locale>[Locale('en'), Locale('ta')];

/// Reaches the locale controls from anywhere below [App].
///
/// An InheritedWidget rather than a package: one value and one callback do
/// not justify a state-management dependency in an app whose pubspec says it
/// deliberately has none.
class LocaleScope extends InheritedWidget {
  const LocaleScope({
    super.key,
    required this.locale,
    required this.setLocale,
    required super.child,
  });

  final Locale locale;
  final ValueChanged<Locale> setLocale;

  static LocaleScope of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<LocaleScope>();
    assert(scope != null, 'No LocaleScope above this widget');
    return scope!;
  }

  @override
  bool updateShouldNotify(LocaleScope oldWidget) => locale != oldWidget.locale;
}

class App extends StatefulWidget {
  const App({
    super.key,
    required this.session,
    required this.settings,
    required this.initialLanguage,
  });

  final MemberSession session;
  final SettingsStore settings;

  /// The stored language code, or null when nobody has chosen one yet.
  ///
  /// Read in `main()` before the first frame, so the app opens in the right
  /// language rather than repainting into it.
  final String? initialLanguage;

  @override
  State<App> createState() => _AppState();
}

class _AppState extends State<App> {
  late Locale _locale;

  /// Whether the language screen still has to be shown.
  ///
  /// Tracked separately from `_locale`, which always holds something: the app
  /// renders in English while the question is on screen, and that must not be
  /// mistaken for an answer.
  late bool _asked;

  @override
  void initState() {
    super.initState();
    _asked = widget.initialLanguage != null;
    _locale = Locale(widget.initialLanguage ?? 'en');
  }

  /// Switches language, and remembers it.
  ///
  /// The write is not awaited by the rebuild: the screen changes language
  /// immediately and the store catches up, because a keystore write is slow
  /// enough to feel like the tap did nothing.
  void _setLocale(Locale locale) {
    setState(() {
      _locale = locale;
      _asked = true;
    });
    widget.settings.saveLanguage(locale.languageCode);
  }

  @override
  Widget build(BuildContext context) {
    return LocaleScope(
      locale: _locale,
      setLocale: _setLocale,
      child: MaterialApp(
        // The association's own name replaces this once the splash has fetched
        // it; this is what the OS task switcher shows in the meantime.
        title: Env.appName,
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light(),
        darkTheme: AppTheme.dark(),
        locale: _locale,
        supportedLocales: supportedLanguages,
        // The three Global delegates are what give Flutter's own widgets
        // Tamil - the date picker, the text-selection menu, every semantic
        // label - none of which is a string this app writes.
        localizationsDelegates: const [
          L.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        home: _asked
            ? SplashScreen(session: widget.session)
            : LanguageScreen(
                // The first screen anybody sees, so it leads to the splash
                // rather than replacing it: the brand moment still happens.
                onChosen: (locale) {
                  _setLocale(locale);
                },
              ),
      ),
    );
  }
}
