import 'package:flutter/material.dart';

/// A field label, with a red asterisk when the field is required.
///
/// The console marks required fields this way and takes required-ness from
/// what the form already enforces, not from what looks important. Same rule
/// here: an asterisk appears only where the server's Zod schema would reject a
/// blank, because marking a field the API accepts empty is as misleading as
/// missing one that it does not.
///
/// It is an explicit prop rather than something derived from the validator, so
/// a label and its input cannot disagree.
class RequiredLabel extends StatelessWidget {
  const RequiredLabel(this.text, {super.key, this.required = false});

  final String text;
  final bool required;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Text.rich(
        TextSpan(
          text: text,
          style: theme.textTheme.labelLarge,
          children: required
              ? [
                  TextSpan(
                    text: ' *',
                    style: theme.textTheme.labelLarge?.copyWith(
                      color: theme.colorScheme.error,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ]
              : null,
        ),
      ),
    );
  }
}
