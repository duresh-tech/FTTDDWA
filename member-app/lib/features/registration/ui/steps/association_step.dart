import 'package:flutter/material.dart';

import '../../../../l10n/app_localizations.dart';
import '../../../../shared/widgets/picker_field.dart';
import '../../../../shared/widgets/required_label.dart';
import '../../data/application_draft.dart';
import '../../data/options.dart';

/// Step 3: the applicant's place in the association.
///
/// Both are required foreign keys on the server, filled from this
/// association's own lookups. Neither cascades off anything, so this step is
/// just two pickers.
class AssociationStep extends StatelessWidget {
  const AssociationStep({
    super.key,
    required this.draft,
    required this.options,
    required this.onChanged,
    this.fixedPositionId,
  });

  final ApplicationDraft draft;
  final MemberOptions options;
  final VoidCallback onChanged;

  /// Set when the association files every applicant under one position.
  final String? fixedPositionId;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (fixedPositionId != null && fixedPositionId!.isNotEmpty)
          // Fixed by the association, so there is nothing to choose. Shown
          // read-only rather than hidden - the applicant should see what they
          // are applying AS - and matching how the website presents it. A
          // one-item dropdown would be an interaction over a decision they
          // were never given.
          _FixedPosition(
            label: l.position,
            name: options.positions
                .where((p) => p.id == fixedPositionId)
                .map((p) => p.label)
                .firstOrNull,
          )
        else
          PickerField(
            label: l.position,
            required: true,
            items: options.positions,
            value: draft.associationPositionId,
            emptyHint: l.noPositions,
            onChanged: (value) {
              draft.associationPositionId = value;
              onChanged();
            },
          ),
        PickerField(
          label: l.trade,
          required: true,
          items: options.industries,
          value: draft.industryId,
          emptyHint: l.noTrades,
          onChanged: (value) {
            draft.industryId = value;
            onChanged();
          },
        ),
      ],
    );
  }
}

/// The position an association has fixed, shown as a settled fact.
///
/// No invented fallback: the server narrows the list to this one row, so a
/// miss means something is wrong and a plausible-looking name would hide it.
class _FixedPosition extends StatelessWidget {
  const _FixedPosition({required this.label, required this.name});

  final String label;
  final String? name;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          RequiredLabel(label),
          InputDecorator(
            decoration: InputDecoration(
              filled: true,
              fillColor: theme.colorScheme.surfaceContainer,
              suffixIcon: Icon(
                Icons.lock_outline,
                size: 18,
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            child: Text(name ?? '', style: theme.textTheme.bodyLarge),
          ),
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(
              L.of(context).positionFixedNote,
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
