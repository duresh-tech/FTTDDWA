import 'package:flutter/material.dart';

/// A label, a value, and the value's Tamil beneath it.
///
/// Returns nothing at all when there is no value: the profile is a list of
/// what this member actually has recorded, and a row reading "WhatsApp: —"
/// tells the reader less than its absence does.
class BilingualRow extends StatelessWidget {
  const BilingualRow({
    super.key,
    required this.label,
    required this.value,
    this.tamil,
    this.monospace = false,
  });

  final String label;
  final String? value;
  final String? tamil;
  final bool monospace;

  bool get hasValue => value != null && value!.trim().isNotEmpty;

  @override
  Widget build(BuildContext context) {
    if (!hasValue) return const SizedBox.shrink();
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 110,
            child: Text(
              label,
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  value!,
                  style: monospace
                      ? theme.textTheme.bodyMedium?.copyWith(
                          fontFeatures: const [],
                        )
                      : theme.textTheme.bodyMedium,
                ),
                if (tamil != null && tamil!.trim().isNotEmpty)
                  Text(
                    tamil!,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
