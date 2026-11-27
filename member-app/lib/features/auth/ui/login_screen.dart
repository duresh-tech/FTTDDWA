import 'package:flutter/material.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/config/env.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/labelled_field.dart';
import '../../profile/ui/profile_screen.dart';
import '../../registration/data/options.dart';
import '../../registration/ui/register_screen.dart';
import '../member_session.dart';

/// Sign in with a membership number and a password.
///
/// The membership number is the identity, not an email: it is unique per
/// association rather than globally, which is also why the request carries the
/// `Origin` header naming this association.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, required this.session, required this.site});

  final MemberSession session;
  final PublicSite site;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();

  String _memberIdNumber = '';
  String _password = '';
  bool _saving = false;

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    setState(() => _saving = true);
    try {
      await widget.session.login(
        memberIdNumber: _memberIdNumber.trim(),
        password: _password,
      );
      if (!mounted) return;
      await Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (_) =>
              ProfileScreen(session: widget.session, site: widget.site),
        ),
      );
    } on ApiException catch (error) {
      if (!mounted) return;
      // The server's messages are already written for the member -- "This
      // membership is suspended. Please contact the association." -- so they
      // are shown as they are rather than mapped to copy of our own.
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final site = widget.site;
    final logo = site.logoPath;

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const SizedBox(height: 12),
                    if (logo != null)
                      // /uploads is served outside the guard pipeline, so a
                      // plain network image needs no key and no token.
                      Image.network(
                        Env.uploadUrl(logo),
                        height: 72,
                        errorBuilder: (_, _, _) => _fallbackMark(theme),
                      )
                    else
                      _fallbackMark(theme),
                    const SizedBox(height: 16),

                    if (site.shortName != null)
                      Text(
                        site.shortName!,
                        textAlign: TextAlign.center,
                        style: theme.textTheme.labelLarge,
                      ),
                    Text(
                      site.name ?? Env.appName,
                      textAlign: TextAlign.center,
                      style: theme.textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    if (site.nameTamil != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        site.nameTamil!,
                        textAlign: TextAlign.center,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                    const SizedBox(height: 28),

                    Card(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(16, 20, 16, 20),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            LabelledField(
                              label: 'Membership number',
                              required: true,
                              hint: 'TN72001',
                              helper: 'Printed on your membership card',
                              textCapitalization: TextCapitalization.characters,
                              onChanged: (value) => _memberIdNumber = value,
                              validator: (value) =>
                                  (value == null || value.trim().isEmpty)
                                  ? 'Enter your membership number'
                                  : null,
                            ),
                            LabelledField(
                              label: 'Password',
                              required: true,
                              obscureText: true,
                              onChanged: (value) => _password = value,
                              validator: (value) =>
                                  (value == null || value.isEmpty)
                                  ? 'Enter your password'
                                  : null,
                            ),

                            const SizedBox(height: 8),
                            FilledButton(
                              onPressed: _saving ? null : _submit,
                              child: _saving
                                  ? const SizedBox(
                                      width: 20,
                                      height: 20,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2.5,
                                      ),
                                    )
                                  : const Text('Sign in'),
                            ),
                          ],
                        ),
                      ),
                    ),

                    // THREE states, not two. Hiding the button is right when
                    // the register is closed and wrong when the association
                    // simply could not be reached - and without `loaded` those
                    // look identical, so a slow network used to read as "this
                    // association does not accept applications".
                    if (site.loaded && site.registrationOpen) ...[
                      const SizedBox(height: 12),
                      OutlinedButton.icon(
                        onPressed: _saving
                            ? null
                            : () => Navigator.of(context).push(
                                MaterialPageRoute(
                                  builder: (_) => RegisterScreen(
                                    session: widget.session,
                                    site: widget.site,
                                  ),
                                ),
                              ),
                        icon: const Icon(Icons.person_add_alt),
                        label: const Text('Apply for membership'),
                      ),
                    ] else if (site.loaded) ...[
                      const SizedBox(height: 12),
                      _Note(
                        icon: Icons.info_outline,
                        text:
                            'This association is not accepting new '
                            'applications at the moment.',
                      ),
                    ] else ...[
                      const SizedBox(height: 12),
                      _Note(
                        icon: Icons.cloud_off,
                        text:
                            'Could not reach the association, so applying is '
                            'unavailable. Signing in may still work.',
                      ),
                    ],

                    const SizedBox(height: 24),
                    Text(
                      'No password yet? Your association sets one up for you.',
                      textAlign: TextAlign.center,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _fallbackMark(ThemeData theme) => Center(
    child: Container(
      width: 64,
      height: 64,
      decoration: BoxDecoration(
        color: theme.colorScheme.primary,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Icon(
        Icons.badge_outlined,
        size: 32,
        color: theme.colorScheme.onPrimary,
      ),
    ),
  );
}

/// A quiet, bordered line of explanation beneath the sign-in form.
class _Note extends StatelessWidget {
  const _Note({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainer,
        borderRadius: AppTheme.borderRadius,
        border: Border.all(color: theme.colorScheme.outlineVariant),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 16, color: theme.colorScheme.onSurfaceVariant),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              text,
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
