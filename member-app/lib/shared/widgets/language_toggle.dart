import 'package:flutter/material.dart';

import '../../app.dart';

/// Switches between Tamil and English, anywhere.
///
/// Each option is written in its own script and never translated, for the
/// same reason the first-run screen does it: the person who most needs this
/// control is the one who cannot read the language currently on screen.
///
/// The change applies immediately and is stored. There is no confirmation,
/// because the result of the tap IS the confirmation — the screen behind it
/// changes language.
class LanguageToggle extends StatelessWidget {
  const LanguageToggle({super.key, this.onSurface = false});

  /// True when it sits on a coloured surface (an AppBar, the gradient header)
  /// rather than on the page background.
  final bool onSurface;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scope = LocaleScope.of(context);
    final isTamil = scope.locale.languageCode == 'ta';

    final foreground = onSurface
        ? Colors.white
        : theme.colorScheme.onSurfaceVariant;
    final border = onSurface
        ? Colors.white.withValues(alpha: 0.4)
        : theme.colorScheme.outlineVariant;

    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: border),
      ),
      padding: const EdgeInsets.all(2),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _Option(
            label: 'தமிழ்',
            selected: isTamil,
            foreground: foreground,
            onSurface: onSurface,
            onTap: () => scope.setLocale(const Locale('ta')),
          ),
          _Option(
            label: 'EN',
            selected: !isTamil,
            foreground: foreground,
            onSurface: onSurface,
            onTap: () => scope.setLocale(const Locale('en')),
          ),
        ],
      ),
    );
  }
}

class _Option extends StatelessWidget {
  const _Option({
    required this.label,
    required this.selected,
    required this.foreground,
    required this.onSurface,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final Color foreground;
  final bool onSurface;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final fill = onSurface
        ? Colors.white.withValues(alpha: 0.22)
        : theme.colorScheme.primary;

    return InkWell(
      onTap: selected ? null : onTap,
      borderRadius: BorderRadius.circular(999),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        curve: Curves.easeOut,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
        decoration: BoxDecoration(
          color: selected ? fill : Colors.transparent,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(
          label,
          style: theme.textTheme.labelMedium?.copyWith(
            fontWeight: FontWeight.w700,
            color: selected
                ? (onSurface ? Colors.white : theme.colorScheme.onPrimary)
                : foreground,
          ),
        ),
      ),
    );
  }
}
