import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';

/// The first screen on a first run: Tamil or English.
///
/// Both options are written **in their own script**, and that is the whole
/// design. Somebody who cannot read English has to be able to find Tamil, so
/// the one word that matters on this screen — `தமிழ்` — is never translated,
/// in either direction. The surrounding copy is translated, but nobody needs
/// to read it to answer.
///
/// It is asked once. The choice is stored and the switcher on the login and
/// profile screens is how it changes afterwards, so this screen is never seen
/// again on a working install.
class LanguageScreen extends StatefulWidget {
  const LanguageScreen({super.key, required this.onChosen});

  /// Called with the chosen locale. The app stores it and moves on.
  final ValueChanged<Locale> onChosen;

  @override
  State<LanguageScreen> createState() => _LanguageScreenState();
}

class _LanguageScreenState extends State<LanguageScreen> {
  /// Tamil first, deliberately: this is a Tamil Nadu association, and the
  /// first option is the one a hurried thumb hits.
  Locale _selected = const Locale('ta');

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      body: DecoratedBox(
        decoration: const BoxDecoration(gradient: AppColors.headerGradient),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(28),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // The association's emblem on a white plate: the artwork
                    // has a white background of its own, so on the gradient it
                    // needs a surface rather than floating as a lit square.
                    Center(
                      child: Container(
                        padding: const EdgeInsets.all(10),
                        decoration: const BoxDecoration(
                          color: Colors.white,
                          shape: BoxShape.circle,
                        ),
                        child: Image.asset(
                          'assets/images/fttddwa-logo.webp',
                          width: 96,
                          height: 96,
                          fit: BoxFit.contain,
                        ),
                      ),
                    ),
                    const SizedBox(height: 28),

                    // Both headings, both scripts, one above the other. There
                    // is no localisation to read from yet in the sense that
                    // matters: whichever language somebody speaks, one of
                    // these two lines is addressed to them.
                    Text(
                      'உங்கள் மொழியைத் தேர்ந்தெடுக்கவும்',
                      textAlign: TextAlign.center,
                      style: theme.textTheme.titleMedium?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Choose your language',
                      textAlign: TextAlign.center,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: Colors.white.withValues(alpha: 0.85),
                      ),
                    ),
                    const SizedBox(height: 24),

                    _LanguageOption(
                      label: 'தமிழ்',
                      sublabel: 'Tamil',
                      selected: _selected.languageCode == 'ta',
                      onTap: () =>
                          setState(() => _selected = const Locale('ta')),
                    ),
                    const SizedBox(height: 12),
                    _LanguageOption(
                      label: 'English',
                      sublabel: 'ஆங்கிலம்',
                      selected: _selected.languageCode == 'en',
                      onTap: () =>
                          setState(() => _selected = const Locale('en')),
                    ),

                    const SizedBox(height: 28),
                    FilledButton(
                      onPressed: () => widget.onChosen(_selected),
                      style: FilledButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: AppColors.primary,
                        minimumSize: const Size.fromHeight(52),
                      ),
                      // Both scripts again: this button is pressed before the
                      // app knows which language to speak.
                      child: Text(
                        _selected.languageCode == 'ta'
                            ? 'தொடரவும்'
                            : 'Continue',
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      _selected.languageCode == 'ta'
                          ? 'இதை பின்னர் மாற்றிக்கொள்ளலாம்.'
                          : 'You can change this later.',
                      textAlign: TextAlign.center,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: Colors.white.withValues(alpha: 0.8),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// One language, as a large tap target.
///
/// Deliberately big: this is the first interaction, often on a cheap phone in
/// a shop, and a radio button would be a smaller target than the words beside
/// it.
class _LanguageOption extends StatelessWidget {
  const _LanguageOption({
    required this.label,
    required this.sublabel,
    required this.selected,
    required this.onTap,
  });

  final String label;

  /// The same language named in the OTHER script, so each row is legible to
  /// either reader.
  final String sublabel;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Material(
      color: selected
          ? Colors.white.withValues(alpha: 0.22)
          : Colors.white.withValues(alpha: 0.08),
      borderRadius: AppTheme.borderRadius,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppTheme.borderRadius,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
          decoration: BoxDecoration(
            borderRadius: AppTheme.borderRadius,
            border: Border.all(
              color: Colors.white.withValues(alpha: selected ? 0.9 : 0.3),
              width: selected ? 2 : 1,
            ),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label,
                      style: theme.textTheme.titleMedium?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    Text(
                      sublabel,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: Colors.white.withValues(alpha: 0.8),
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                selected ? Icons.radio_button_checked : Icons.radio_button_off,
                color: Colors.white,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
