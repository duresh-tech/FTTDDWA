import 'package:flutter/material.dart';

import '../../../../shared/widgets/date_field.dart';
import '../../../../shared/widgets/labelled_field.dart';
import '../../../../shared/validation.dart';
import '../../../../shared/widgets/photo_field.dart';
import '../../data/application_draft.dart';

/// Step 1: who the applicant is.
///
/// The Tamil name fields are optional on the server and optional here. A
/// business may only ever have recorded English, and demanding a Tamil
/// spelling from someone who does not use one would be worse than leaving the
/// column null.
class IdentityStep extends StatelessWidget {
  const IdentityStep({
    super.key,
    required this.draft,
    required this.onChanged,
    required this.onPhotoPicked,
    this.photoUploading = false,
  });

  final ApplicationDraft draft;

  /// Rebuilds the parent, which is what makes the wedding-date field appear.
  final VoidCallback onChanged;

  /// The screen owns the upload - see PhotoField.
  final Future<void> Function(List<int> bytes, String filename) onPhotoPicked;
  final bool photoUploading;

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
          // Optional, but Tamil when given. Checked on submit rather than per
          // keystroke: a transliteration keyboard shows Latin while it is
          // composing, and filtering input would break it.
          validator: (v) => tamilOnly(v, 'Your Tamil name'),
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
          validator: (v) => tamilOnly(v, 'The Tamil business name'),
        ),

        DateField(
          label: 'Date of birth',
          required: true,
          value: draft.dateOfBirth,
          // The picker cannot offer a date that fails the age floor. The step
          // checks it again, because `value` could be set from elsewhere.
          lastDate: latestBirthDate(),
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
            required: true,
            value: draft.weddingDate,
            // Never before the applicant was born, and never in the future.
            // `firstDate` only binds once a birth date is chosen.
            firstDate: DateTime.tryParse(draft.dateOfBirth),
            onChanged: (v) {
              draft.weddingDate = v;
              onChanged();
            },
          ),

        const SizedBox(height: 8),
        LabelledField(
          label: 'Aadhaar number (optional)',
          hint: '1234 5678 9012',
          helper: 'Stored encrypted. Only the last four digits are ever shown.',
          keyboardType: TextInputType.number,
          initialValue: draft.aadhaarNumber,
          onChanged: (v) => draft.aadhaarNumber = v,
          validator: (value) {
            // OPTIONAL, matching the server and the website. Blank is fine;
            // a half-entered number is not, so the length is still checked
            // once somebody has started typing.
            final digits = (value ?? '').replaceAll(RegExp(r'\D'), '');
            if (digits.isEmpty) return null;
            if (digits.length != 12) {
              return 'An Aadhaar number has 12 digits (you entered ${digits.length})';
            }
            return null;
          },
        ),

        PhotoField(
          label: 'Your photo',
          storedPath: draft.passportPhotoPath,
          uploading: photoUploading,
          onPicked: onPhotoPicked,
          helper: 'Optional. Printed on your membership card.',
        ),
      ],
    );
  }

  static String? Function(String?) _notEmpty(String message) =>
      (value) => (value == null || value.trim().isEmpty) ? message : null;
}
