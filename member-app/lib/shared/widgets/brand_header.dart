import 'package:flutter/material.dart';

import '../../core/config/env.dart';
import '../../features/registration/data/options.dart';

/// The association's masthead: two emblems with its name between them.
///
/// The layout mirrors the association's own printed letterhead — FTTDDWA's
/// mark on the left, the national body's on the right, the name centred.
///
/// Both emblems are artwork with **white backgrounds**, so each sits on a
/// white circular plate. Without it they read as lit squares against the dark
/// theme's `#0B0F19`, which is the giveaway of a logo dropped onto a surface
/// it was not drawn for.
class BrandHeader extends StatelessWidget {
  const BrandHeader({super.key, required this.site, this.tamil = false});

  final PublicSite site;

  /// Whether to prefer the association's Tamil name.
  ///
  /// The names come from the SERVER, not from this app's translations: an
  /// association's registered name is a fact about it, not a string we get to
  /// translate. When the Tamil name is unset it falls back to the English
  /// one, which is why Tamil mode can still read English here until somebody
  /// fills it in the console.
  final bool tamil;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    final name = tamil ? (site.nameTamil ?? site.name) : site.name;
    final short = tamil
        ? (site.shortNameTamil ?? site.shortName)
        : site.shortName;
    // The other script's name, shown underneath when it differs - the way the
    // rest of this app treats Tamil, as a rendering of the same value rather
    // than a translation of it.
    final secondary = tamil ? site.name : site.nameTamil;

    return Column(
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            const _Emblem('assets/images/fttddwa-logo.webp'),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 10),
                child: Column(
                  children: [
                    if (short != null && short.isNotEmpty)
                      Text(
                        short,
                        textAlign: TextAlign.center,
                        style: theme.textTheme.labelLarge?.copyWith(
                          color: theme.colorScheme.primary,
                          letterSpacing: 1.1,
                        ),
                      ),
                    Text(
                      name ?? Env.appName,
                      textAlign: TextAlign.center,
                      // Four lines, because the full registered name runs to
                      // three on a phone and Tamil runs longer than English.
                      maxLines: 4,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.bold,
                        height: 1.25,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const _Emblem('assets/images/logo2.webp'),
          ],
        ),
        if (secondary != null && secondary.isNotEmpty) ...[
          const SizedBox(height: 8),
          Text(
            secondary,
            textAlign: TextAlign.center,
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ],
    );
  }
}

/// One emblem, on the white plate its artwork assumes.
class _Emblem extends StatelessWidget {
  const _Emblem(this.asset);

  final String asset;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 64,
      height: 64,
      padding: const EdgeInsets.all(3),
      decoration: const BoxDecoration(
        color: Colors.white,
        shape: BoxShape.circle,
      ),
      child: Image.asset(asset, fit: BoxFit.contain),
    );
  }
}
