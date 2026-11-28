import 'package:flutter/material.dart';

import '../../../../l10n/app_localizations.dart';
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
    final l = L.of(context);
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        PickerField(
          label: l.state,
          required: true,
          items: options.states,
          value: draft.stateId,
          emptyHint: l.noStates,
          onChanged: (value) {
            // Clears district, taluk and RTO together: a stale child under a
            // new parent fails the server's chain check with a message that
            // would not point at the real problem.
            draft.setState(value);
            onChanged();
          },
        ),
        PickerField(
          label: l.district,
          required: true,
          items: options.districtsOf(draft.stateId),
          value: draft.districtId,
          disabledHint: draft.stateId == null ? l.chooseStateFirst : null,
          emptyHint: l.noDistrictsInState,
          onChanged: (value) {
            draft.setDistrict(value);
            onChanged();
          },
        ),
        PickerField(
          label: l.taluk,
          required: true,
          items: options.taluksOf(draft.districtId),
          value: draft.talukId,
          disabledHint: draft.districtId == null ? l.chooseDistrictFirst : null,
          emptyHint: l.noTaluksInDistrict,
          onChanged: (value) {
            draft.talukId = value;
            onChanged();
          },
        ),
        PickerField(
          label: l.rto,
          required: true,
          items: options.rtosOf(draft.districtId),
          value: draft.rtoId,
          disabledHint: draft.districtId == null ? l.chooseDistrictFirst : null,
          emptyHint: l.noRtosInDistrict,
          onChanged: (value) {
            draft.rtoId = value;
            onChanged();
          },
        ),
        Text(
          l.rtoNote,
          style: theme.textTheme.bodySmall?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
      ],
    );
  }
}
