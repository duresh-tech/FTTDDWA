import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/app_theme.dart';
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
                const Spacer(),
                if (!loading && card != null)
                  _StatusPill(
                    label: card!.expired ? 'Expired' : 'Valid',
                    // Not `error`: an expired card is a thing to renew, not a
                    // fault. The console uses the same amber for it.
                    colour: card!.expired
                        ? AppStatusColors.of(context).warning
                        : AppStatusColors.of(context).success,
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
                                ? AppStatusColors.of(context).warning
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
                _Notice(
                  colour: AppStatusColors.of(context).warning,
                  message:
                      'This card has expired. Contact your association for a '
                      'new one.',
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }
}

/// A one-word state, tinted from [AppStatusColors].
class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.label, required this.colour});

  final String label;
  final Color colour;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration: BoxDecoration(
        // A tint of the status colour, not the colour itself: these sit on a
        // white card and a solid fill would outweigh the heading beside them.
        color: colour.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: colour.withValues(alpha: 0.32)),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
          color: colour,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

/// A tinted band of explanatory text, in the status colour it belongs to.
class _Notice extends StatelessWidget {
  const _Notice({required this.colour, required this.message});

  final Color colour;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: colour.withValues(alpha: 0.10),
        borderRadius: AppTheme.borderRadius,
        border: Border.all(color: colour.withValues(alpha: 0.28)),
      ),
      child: Text(
        message,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colour),
      ),
    );
  }
}
