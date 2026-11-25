import 'package:flutter/material.dart';

import 'required_label.dart';

/// A labelled text field.
///
/// Thin on purpose: it exists so every field in the app spaces and marks
/// itself the same way, not to abstract over `TextFormField`.
class LabelledField extends StatelessWidget {
  const LabelledField({
    super.key,
    required this.label,
    required this.onChanged,
    this.initialValue,
    this.required = false,
    this.hint,
    this.helper,
    this.keyboardType,
    this.obscureText = false,
    this.maxLength,
    this.maxLines = 1,
    this.validator,
    this.textCapitalization = TextCapitalization.none,
  });

  final String label;
  final ValueChanged<String> onChanged;
  final String? initialValue;
  final bool required;
  final String? hint;
  final String? helper;
  final TextInputType? keyboardType;
  final bool obscureText;
  final int? maxLength;
  final int maxLines;
  final String? Function(String?)? validator;
  final TextCapitalization textCapitalization;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          RequiredLabel(label, required: required),
          TextFormField(
            initialValue: initialValue,
            onChanged: onChanged,
            keyboardType: keyboardType,
            obscureText: obscureText,
            maxLength: maxLength,
            maxLines: obscureText ? 1 : maxLines,
            textCapitalization: textCapitalization,
            validator: validator,
            decoration: InputDecoration(
              hintText: hint,
              helperText: helper,
              // The server enforces the real limits; a visible counter on
              // every field is noise.
              counterText: '',
            ),
          ),
        ],
      ),
    );
  }
}
