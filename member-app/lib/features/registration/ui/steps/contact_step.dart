import 'package:flutter/material.dart';

import '../../../../shared/widgets/labelled_field.dart';
import '../../data/application_draft.dart';

/// Step 2: how to reach the applicant, and the password they will sign in with.
///
/// The password lives here rather than on a step of its own because it belongs
/// with the other account details. It is carried across unchanged when staff
/// approve the application -- the hash is MOVED, not re-derived -- so whatever
/// is typed here is what signs them in afterwards.
class ContactStep extends StatelessWidget {
  const ContactStep({super.key, required this.draft, required this.onChanged});

  final ApplicationDraft draft;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        LabelledField(
          label: 'Phone number',
          required: true,
          keyboardType: TextInputType.phone,
          initialValue: draft.phoneNumber,
          onChanged: (v) => draft.phoneNumber = v,
          validator: (value) {
            final trimmed = (value ?? '').trim();
            if (trimmed.isEmpty) return 'Enter your phone number';
            if (trimmed.length < 5) return 'That looks too short';
            return null;
          },
        ),
        LabelledField(
          label: 'WhatsApp number',
          helper: 'Leave blank if it is the same as your phone number',
          keyboardType: TextInputType.phone,
          initialValue: draft.whatsappNumber,
          onChanged: (v) => draft.whatsappNumber = v,
        ),
        LabelledField(
          label: 'Email',
          required: true,
          keyboardType: TextInputType.emailAddress,
          initialValue: draft.email,
          onChanged: (v) => draft.email = v,
          validator: (value) {
            final trimmed = (value ?? '').trim();
            if (trimmed.isEmpty) return 'Enter your email';
            // Deliberately loose. The server validates properly; this is only
            // here to catch an obvious slip before a round trip.
            if (!trimmed.contains('@') || !trimmed.contains('.')) {
              return 'Enter a valid email address';
            }
            return null;
          },
        ),
        LabelledField(
          label: 'Address line 1',
          required: true,
          maxLines: 2,
          textCapitalization: TextCapitalization.words,
          initialValue: draft.addressLine1,
          onChanged: (v) => draft.addressLine1 = v,
          validator: (value) => (value == null || value.trim().isEmpty)
              ? 'Enter your address'
              : null,
        ),
        LabelledField(
          label: 'Address line 2',
          maxLines: 2,
          textCapitalization: TextCapitalization.words,
          initialValue: draft.addressLine2,
          onChanged: (v) => draft.addressLine2 = v,
        ),

        const Divider(height: 32),
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Text(
            'Signing in',
            style: theme.textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(bottom: 16),
          child: Text(
            'Once your application is approved you will sign in with your '
            'membership number and this password.',
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
        ),

        LabelledField(
          label: 'Password',
          required: true,
          obscureText: true,
          helper: 'At least 8 characters',
          onChanged: (v) {
            draft.password = v;
            onChanged();
          },
          validator: (value) {
            if (value == null || value.isEmpty) return 'Choose a password';
            // The server's minimum, so a shorter one is a guaranteed 400.
            if (value.length < 8) return 'Use at least 8 characters';
            return null;
          },
        ),
        LabelledField(
          label: 'Confirm password',
          required: true,
          obscureText: true,
          onChanged: (v) => draft.confirmPassword = v,
          validator: (value) {
            if (value == null || value.isEmpty) return 'Repeat your password';
            if (value != draft.password) return 'The passwords do not match';
            return null;
          },
        ),
      ],
    );
  }
}
