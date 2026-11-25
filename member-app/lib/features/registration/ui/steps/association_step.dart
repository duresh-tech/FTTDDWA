import 'package:flutter/material.dart';

import '../../../../shared/widgets/picker_field.dart';
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
  });

  final ApplicationDraft draft;
  final MemberOptions options;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        PickerField(
          label: 'Position',
          required: true,
          items: options.positions,
          value: draft.associationPositionId,
          emptyHint: 'This association has no positions set up yet',
          onChanged: (value) {
            draft.associationPositionId = value;
            onChanged();
          },
        ),
        PickerField(
          label: 'Trade',
          required: true,
          items: options.industries,
          value: draft.industryId,
          emptyHint: 'This association has no trades set up yet',
          onChanged: (value) {
            draft.industryId = value;
            onChanged();
          },
        ),
      ],
    );
  }
}
