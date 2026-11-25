import 'package:flutter/material.dart';

import 'required_label.dart';

/// A tappable date field that reads and writes `YYYY-MM-DD`.
///
/// That format is the wire format: `dateOfBirth` and `weddingDate` are
/// VarChar(10) strings on this API, not epochs, and the server validates them
/// against `/^\d{4}-\d{2}-\d{2}$/` AND that they parse as a real date. A
/// picker is the only input that cannot produce `2026-02-31`.
class DateField extends StatelessWidget {
  const DateField({
    super.key,
    required this.label,
    required this.value,
    required this.onChanged,
    this.required = false,
    this.helper,
    this.firstDate,
    this.lastDate,
  });

  final String label;

  /// `YYYY-MM-DD`, or empty when unset.
  final String value;
  final ValueChanged<String> onChanged;
  final bool required;
  final String? helper;
  final DateTime? firstDate;
  final DateTime? lastDate;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final parsed = DateTime.tryParse(value);

    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          RequiredLabel(label, required: required),
          InkWell(
            onTap: () async {
              final now = DateTime.now();
              final picked = await showDatePicker(
                context: context,
                initialDate: parsed ?? DateTime(now.year - 30),
                firstDate: firstDate ?? DateTime(1920),
                lastDate: lastDate ?? now,
              );
              if (picked != null) onChanged(_format(picked));
            },
            child: InputDecorator(
              decoration: InputDecoration(
                helperText: helper,
                suffixIcon: const Icon(Icons.calendar_today, size: 18),
              ),
              isEmpty: parsed == null,
              child: parsed == null
                  ? null
                  : Text(value, style: theme.textTheme.bodyLarge),
            ),
          ),
        ],
      ),
    );
  }

  /// Zero-padded, because `2026-1-5` fails the server's pattern.
  static String _format(DateTime date) =>
      '${date.year.toString().padLeft(4, '0')}-'
      '${date.month.toString().padLeft(2, '0')}-'
      '${date.day.toString().padLeft(2, '0')}';
}
