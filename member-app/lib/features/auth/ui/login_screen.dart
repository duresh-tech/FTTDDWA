import 'package:flutter/material.dart';

import '../../../app.dart';
import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../l10n/app_localizations.dart';
import '../../../shared/widgets/brand_header.dart';
import '../../../shared/widgets/labelled_field.dart';
import '../../../shared/widgets/language_toggle.dart';
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
    final l = L.of(context);
    final site = widget.site;
    final tamil = LocaleScope.of(context).locale.languageCode == 'ta';

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
                    // The switcher sits ABOVE the fold and before the
                    // form: somebody who opened the app in the wrong language
                    // should not have to read anything to fix it.
                    Align(
                      alignment: Alignment.centerRight,
                      child: LanguageToggle(),
                    ),
                    const SizedBox(height: 8),
                    BrandHeader(site: site, tamil: tamil),
                    const SizedBox(height: 24),

                    Card(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(16, 20, 16, 20),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            LabelledField(
                              label: l.membershipNumber,
                              required: true,
                              // No example number. The helper below says where
                              // to find the real one, which is the part that
                              // helps - a sample in the box is one more thing
                              // to read past, and reads as a filled field at a
                              // glance.
                              helper: l.membershipNumberHelper,
                              textCapitalization: TextCapitalization.characters,
                              onChanged: (value) => _memberIdNumber = value,
                              validator: (value) =>
                                  (value == null || value.trim().isEmpty)
                                  ? l.membershipNumberRequired
                                  : null,
                            ),
                            LabelledField(
                              label: l.password,
                              required: true,
                              obscureText: true,
                              onChanged: (value) => _password = value,
                              validator: (value) =>
                                  (value == null || value.isEmpty)
                                  ? l.passwordRequired
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
                                  : Text(l.signIn),
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
                        label: Text(l.applyForMembership),
                      ),
                    ] else if (site.loaded) ...[
                      const SizedBox(height: 12),
                      _Note(icon: Icons.info_outline, text: l.registerClosed),
                    ] else ...[
                      const SizedBox(height: 12),
                      _Note(icon: Icons.cloud_off, text: l.siteUnreachable),
                    ],

                    const SizedBox(height: 24),
                    Text(
                      l.noPasswordYet,
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
