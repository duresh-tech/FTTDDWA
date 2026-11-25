import 'package:flutter/material.dart';

import '../../../../shared/widgets/picker_field.dart';
import '../../data/application_draft.dart';
import '../../data/options.dart';

/// Step 4: where the applicant is, and which RTO they register under.
///
/// The cascade is state -> district -> taluk, all in memory from the single
/// `options` call.
///
/// **The RTO hangs off the DISTRICT, not the taluk above it.** The layout
/// invites the opposite assumption, and the API's own field name encourages it
/// further: every other list names its parent `stateId` or `districtId`, while
/// RTOs use `tenantDistrictId`.
class LocationStep extends StatelessWidget {
  const LocationStep({
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
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        PickerField(
          label: 'State',
          required: true,
          items: options.states,
          value: draft.stateId,
          emptyHint: 'This association has no states set up yet',
          onChanged: (value) {
            // Clears district, taluk and RTO together: a stale child under a
            // new parent fails the server's chain check with a message that
            // would not point at the real problem.
            draft.setState(value);
            onChanged();
          },
        ),
        PickerField(
          label: 'District',
          required: true,
          items: options.districtsOf(draft.stateId),
          value: draft.districtId,
          disabledHint: draft.stateId == null ? 'Choose a state first' : null,
          emptyHint: 'No districts in that state',
          onChanged: (value) {
            draft.setDistrict(value);
            onChanged();
          },
        ),
        PickerField(
          label: 'Taluk',
          required: true,
          items: options.taluksOf(draft.districtId),
          value: draft.talukId,
          disabledHint: draft.districtId == null
              ? 'Choose a district first'
              : null,
          emptyHint: 'No taluks in that district',
          onChanged: (value) {
            draft.talukId = value;
            onChanged();
          },
        ),
        PickerField(
          label: 'RTO',
          required: true,
          items: options.rtosOf(draft.districtId),
          value: draft.rtoId,
          disabledHint: draft.districtId == null
              ? 'Choose a district first'
              : null,
          emptyHint: 'No RTOs in that district',
          onChanged: (value) {
            draft.rtoId = value;
            onChanged();
          },
        ),
        Text(
          'Your membership number is issued from this RTO, so it cannot be '
          'changed later.',
          style: theme.textTheme.bodySmall?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
      ],
    );
  }
}
