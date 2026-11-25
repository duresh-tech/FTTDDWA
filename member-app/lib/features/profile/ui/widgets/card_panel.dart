import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../data/id_card.dart';

/// The member's membership card: its state, and a way to get the PDF.
///
/// Three states, and they are genuinely different:
///
/// - **unknown** -- still loading
/// - **none** -- no ACTIVE card. Common, and not an error: most members have
///   none until the association issues one, and a revoked card leaves them
///   here too
/// - **issued** -- show the issue number and expiry, and offer the download
class CardPanel extends StatelessWidget {
  const CardPanel({
    super.key,
    required this.card,
    required this.loading,
    required this.downloading,
    required this.onDownload,
  });

  /// Null means none issued. Distinguish from [loading].
  final IdCard? card;
  final bool loading;
  final bool downloading;
  final VoidCallback onDownload;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final dates = DateFormat.yMMMd();

    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  Icons.badge_outlined,
                  size: 20,
                  color: theme.colorScheme.primary,
                ),
                const SizedBox(width: 8),
                Text(
                  'Membership card',
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            if (loading)
              Text('Checking…', style: theme.textTheme.bodySmall)
            else if (card == null)
              Text(
                'None issued yet. Your association issues these — ask them if '
                'you need one.',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              )
            else ...[
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Issue ${card!.issueNumber}',
                          style: theme.textTheme.bodyMedium,
                        ),
                        Text(
                          card!.expiresOn == null
                              ? 'No expiry'
                              : card!.expired
                              // `expired` is computed server-side from the
                              // date and the clock -- there is no EXPIRED
                              // status to read, deliberately.
                              ? 'Expired ${dates.format(card!.expiresOn!)}'
                              : 'Valid until ${dates.format(card!.expiresOn!)}',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: card!.expired
                                ? theme.colorScheme.error
                                : theme.colorScheme.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
                  ),
                  OutlinedButton.icon(
                    onPressed: downloading ? null : onDownload,
                    icon: downloading
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.download, size: 18),
                    label: const Text('Download'),
                  ),
                ],
              ),
              if (card!.expired) ...[
                const SizedBox(height: 10),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: theme.colorScheme.errorContainer,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    'This card has expired. Contact your association for a '
                    'new one.',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onErrorContainer,
                    ),
                  ),
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }
}
