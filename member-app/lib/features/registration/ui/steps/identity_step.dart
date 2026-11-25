import 'package:flutter/material.dart';

import '../../../../shared/widgets/date_field.dart';
import '../../../../shared/widgets/labelled_field.dart';
import '../../data/application_draft.dart';

/// Step 1: who the applicant is.
///
/// The Tamil name fields are optional on the server and optional here. A
/// business may only ever have recorded English, and demanding a Tamil
/// spelling from someone who does not use one would be worse than leaving the
/// column null.
class IdentityStep extends StatelessWidget {
  const IdentityStep({super.key, required this.draft, required this.onChanged});

  final ApplicationDraft draft;

  /// Rebuilds the parent, which is what makes the wedding-date field appear.
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        LabelledField(
          label: 'Your name',
          required: true,
          initialValue: draft.memberName,
          textCapitalization: TextCapitalization.words,
          onChanged: (v) => draft.memberName = v,
          validator: _notEmpty('Enter your name'),
        ),
        LabelledField(
          label: 'Your name in Tamil',
          initialValue: draft.memberNameTamil,
          onChanged: (v) => draft.memberNameTamil = v,
        ),
        LabelledField(
          label: 'Business name',
          required: true,
          initialValue: draft.businessName,
          textCapitalization: TextCapitalization.words,
          onChanged: (v) => draft.businessName = v,
          validator: _notEmpty('Enter your business name'),
        ),
        LabelledField(
          label: 'Business name in Tamil',
          initialValue: draft.businessNameTamil,
          onChanged: (v) => draft.businessNameTamil = v,
        ),

        DateField(
          label: 'Date of birth',
          required: true,
          value: draft.dateOfBirth,
          onChanged: (v) {
            draft.dateOfBirth = v;
            onChanged();
          },
        ),

        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: Text('Married', style: theme.textTheme.labelLarge),
          value: draft.isMarried,
          onChanged: (v) {
            draft.isMarried = v;
            // The server REJECTS a wedding date when isMarried is false, so
            // clearing it here keeps an un-ticked switch from carrying a stale
            // date into a 400.
            if (!v) draft.weddingDate = '';
            onChanged();
          },
        ),
        if (draft.isMarried)
          DateField(
            label: 'Wedding date',
            value: draft.weddingDate,
            onChanged: (v) {
              draft.weddingDate = v;
              onChanged();
            },
          ),

        const SizedBox(height: 8),
        LabelledField(
          label: 'Aadhaar number',
          required: true,
          hint: '1234 5678 9012',
          helper: 'Stored encrypted. Only the last four digits are ever shown.',
          keyboardType: TextInputType.number,
          initialValue: draft.aadhaarNumber,
          onChanged: (v) => draft.aadhaarNumber = v,
          validator: (value) {
            // Spacing is fine -- the server strips non-digits too -- but the
            // result has to be exactly 12.
            final digits = (value ?? '').replaceAll(RegExp(r'\D'), '');
            if (digits.isEmpty) return 'Enter your Aadhaar number';
            if (digits.length != 12) {
              return 'An Aadhaar number has 12 digits (you entered ${digits.length})';
            }
            return null;
          },
        ),
      ],
    );
  }

  static String? Function(String?) _notEmpty(String message) =>
      (value) => (value == null || value.trim().isEmpty) ? message : null;
}
