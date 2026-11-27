import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../data/application_draft.dart';
import '../data/options.dart';

/// Confirmation after an application is filed.
///
/// It shows the application number and says plainly that staff review it. An
/// application grants NOTHING until approved -- no membership number, no
/// portal access, no row anything joins to -- so this screen must not read
/// like a welcome.
class ApplicationSubmittedScreen extends StatelessWidget {
  const ApplicationSubmittedScreen({
    super.key,
    required this.application,
    required this.site,
  });

  final SubmittedApplication application;
  final PublicSite site;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final status = AppStatusColors.of(context);

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(28),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  // Success-tinted, not primary: this screen reports an
                  // outcome. It is still deliberately not a tick - nothing has
                  // been granted yet, only received.
                  Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: status.success.withValues(alpha: 0.12),
                      border: Border.all(
                        color: status.success.withValues(alpha: 0.3),
                      ),
                    ),
                    child: Icon(
                      Icons.mark_email_read_outlined,
                      size: 34,
                      color: status.success,
                    ),
                  ),
                  const SizedBox(height: 20),
                  Text(
                    'Application received',
                    style: theme.textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 20),

                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 20,
                      vertical: 16,
                    ),
                    decoration: BoxDecoration(
                      color: theme.colorScheme.surfaceContainerLowest,
                      borderRadius: AppTheme.borderRadius,
                      border: Border.all(
                        color: theme.colorScheme.outlineVariant,
                      ),
                    ),
                    child: Column(
                      children: [
                        Text(
                          'Your application number',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: theme.colorScheme.onSurfaceVariant,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          application.applicationNumber,
                          style: theme.textTheme.headlineSmall?.copyWith(
                            fontWeight: FontWeight.bold,
                            letterSpacing: 2,
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 20),
                  Text(
                    'Keep this number. ${site.shortName ?? 'The association'} '
                    'will review your application, and you will be able to '
                    'sign in once it is approved.',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Your membership number is issued on approval, not now.',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),

                  const SizedBox(height: 28),
                  FilledButton(
                    // Back to login: this screen replaced the form, so popping
                    // returns to where Apply was tapped.
                    onPressed: () => Navigator.of(context).pop(),
                    child: const Text('Back to sign in'),
                  ),

                  if (site.phoneNumber != null || site.email != null) ...[
                    const SizedBox(height: 20),
                    Text(
                      'Questions? ${[site.phoneNumber, site.email].where((v) => v != null).join('  ·  ')}',
                      textAlign: TextAlign.center,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
