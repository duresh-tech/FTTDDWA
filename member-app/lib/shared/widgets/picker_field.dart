import 'package:flutter/material.dart';

import '../../features/registration/data/options.dart';
import 'required_label.dart';

/// A dropdown fed by one of the lookup lists.
///
/// Handles the two states a cascading picker is actually in most of the time:
/// nothing selected upstream, and nothing available downstream. Both say so
/// rather than presenting an empty menu, because an empty dropdown reads as a
/// broken app when it usually means "choose the district first".
class PickerField extends StatelessWidget {
  const PickerField({
    super.key,
    required this.label,
    required this.items,
    required this.value,
    required this.onChanged,
    this.required = false,
    this.disabledHint,
    this.emptyHint,
  });

  final String label;
  final List<LookupItem> items;
  final String? value;
  final ValueChanged<String?> onChanged;
  final bool required;

  /// Shown when there is no parent selected yet.
  final String? disabledHint;

  /// Shown when the parent is selected but has no children.
  final String? emptyHint;

  @override
  Widget build(BuildContext context) {
    final enabled = disabledHint == null;
    // A value no longer in the list (the parent changed) must not be handed to
    // DropdownButtonFormField -- it asserts on a value with no matching item.
    final safeValue = items.any((item) => item.id == value) ? value : null;

    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          RequiredLabel(label, required: required),
          DropdownButtonFormField<String>(
            initialValue: safeValue,
            isExpanded: true,
            // The CLOSED field shows one line; the open menu shows two.
            //
            // Without this the selected item reuses the two-line menu entry,
            // which does not fit the field's content height and overflows by
            // 16px -- visible as the debug stripe, and a clipped Tamil line in
            // release. The Tamil name is there to help someone CHOOSE, so the
            // menu is where it earns its space; once chosen, the label is
            // confirmation and one line is enough.
            selectedItemBuilder: (context) => items
                .map(
                  (item) => Align(
                    alignment: AlignmentDirectional.centerStart,
                    child: Text(
                      item.label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                )
                .toList(),
            items: items
                .map(
                  (item) => DropdownMenuItem(
                    value: item.id,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(item.label, overflow: TextOverflow.ellipsis),
                        if (item.tamil != null && item.tamil!.isNotEmpty)
                          Text(
                            item.tamil!,
                            style: Theme.of(context).textTheme.bodySmall,
                            overflow: TextOverflow.ellipsis,
                          ),
                      ],
                    ),
                  ),
                )
                .toList(),
            onChanged: enabled && items.isNotEmpty ? onChanged : null,
            decoration: InputDecoration(
              hintText: !enabled
                  ? disabledHint
                  : items.isEmpty
                  ? (emptyHint ?? 'Nothing available')
                  : 'Select',
            ),
          ),
        ],
      ),
    );
  }
}
