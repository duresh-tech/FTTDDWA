import 'package:flutter/material.dart';

import '../../../core/api/api_exception.dart';
import '../../auth/member_session.dart';
import '../data/application_draft.dart';
import '../data/options.dart';
import '../data/registration_api.dart';
import 'application_submitted_screen.dart';
import 'steps/association_step.dart';
import 'steps/contact_step.dart';
import 'steps/identity_step.dart';
import 'steps/location_step.dart';

/// The membership application, over four steps.
///
/// It collects everything `tenant_member_applications` holds, because that is
/// the point of the table: the applicant supplies their details once and
/// approval is a copy rather than a second interview.
///
/// What it does NOT collect is a passport photo -- there is no public upload
/// route, so staff attach one at approval.
///
/// Submitting creates an APPLICATION, never a member. No membership number, no
/// session, nothing to sign in with until staff approve it.
class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key, required this.session, required this.site});

  final MemberSession session;
  final PublicSite site;

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  static const _titles = [
    'Identity',
    'Contact & sign-in',
    'Association',
    'Location',
  ];

  final _draft = ApplicationDraft();
  // One form per step, so Next validates only what is on screen.
  final _formKeys = List.generate(4, (_) => GlobalKey<FormState>());

  late final RegistrationApi _api = RegistrationApi(widget.session.client);

  MemberOptions? _options;
  String? _loadError;
  int _step = 0;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _loadOptions();
  }

  Future<void> _loadOptions() async {
    setState(() => _loadError = null);
    try {
      final options = await _api.options();
      if (!mounted) return;
      setState(() {
        _options = options;
        // The association may file every applicant under one position, in
        // which case the server has already narrowed this list to it. Choose
        // it for them rather than making them open a one-item picker to
        // satisfy a field they were never given a decision about.
        final fixed = widget.site.fixedPositionId;
        if (fixed != null && fixed.isNotEmpty) {
          _draft.associationPositionId = fixed;
        } else if (options.positions.length == 1) {
          _draft.associationPositionId = options.positions.single.id;
        }
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _loadError = error.message);
    }
  }

  /// Validates the step on screen.
  ///
  /// Steps 1 and 2 are text, so their `Form` does it. Steps 3 and 4 are
  /// pickers, which carry no validator, so their required ids are checked
  /// here.
  bool _validateStep() {
    switch (_step) {
      case 0:
        // The date of birth is NOT a FormField -- DateField is a tappable
        // InputDecorator -- so Form.validate() walks straight past it. Without
        // this, an applicant reaches step 4, submits, and gets the server's
        // "dateOfBirth: Required" three screens away from the field it means.
        final textValid = _formKeys[0].currentState?.validate() ?? false;
        if (_draft.dateOfBirth.isEmpty) {
          _require({'a date of birth': null});
          return false;
        }
        return textValid;
      case 1:
        return _formKeys[_step].currentState?.validate() ?? false;
      case 2:
        return _require({
          'a position': _draft.associationPositionId,
          'a trade': _draft.industryId,
        });
      case 3:
        return _require({
          'a state': _draft.stateId,
          'a district': _draft.districtId,
          'a taluk': _draft.talukId,
          'an RTO': _draft.rtoId,
        });
      default:
        return true;
    }
  }

  bool _require(Map<String, String?> fields) {
    final missing = fields.entries.where((e) => e.value == null).toList();
    if (missing.isEmpty) return true;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text('Choose ${missing.first.key}')));
    return false;
  }

  void _next() {
    if (!_validateStep()) return;
    if (_step < _titles.length - 1) {
      setState(() => _step++);
    } else {
      _submit();
    }
  }

  Future<void> _submit() async {
    setState(() => _saving = true);
    try {
      final submitted = await _api.apply(_draft);
      if (!mounted) return;
      await Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (_) => ApplicationSubmittedScreen(
            application: submitted,
            site: widget.site,
          ),
        ),
      );
    } on ApiException catch (error) {
      if (!mounted) return;
      // The useful failures here are all the server's: registration turned
      // off (403), an Aadhaar that already belongs to a member, a duplicate
      // application, or a broken geography chain. Each already says what to do.
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.message),
          duration: const Duration(seconds: 6),
        ),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final options = _options;
    final isLast = _step == _titles.length - 1;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Apply for membership'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(4),
          child: LinearProgressIndicator(
            value: (_step + 1) / _titles.length,
            minHeight: 4,
          ),
        ),
      ),
      body: SafeArea(
        child: _loadError != null
            ? _ErrorState(message: _loadError!, onRetry: _loadOptions)
            : options == null
            ? const Center(child: CircularProgressIndicator())
            : Column(
                children: [
                  Expanded(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.all(20),
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 520),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text(
                              'Step ${_step + 1} of ${_titles.length}',
                              style: theme.textTheme.labelMedium?.copyWith(
                                color: theme.colorScheme.primary,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              _titles[_step],
                              style: theme.textTheme.titleLarge?.copyWith(
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(height: 20),
                            // IndexedStack, not a rebuild per step: it
                            // keeps each step's TextFormField state alive
                            // so going back does not wipe what was typed.
                            IndexedStack(
                              index: _step,
                              sizing: StackFit.loose,
                              children: [
                                Form(
                                  key: _formKeys[0],
                                  child: IdentityStep(
                                    draft: _draft,
                                    onChanged: () => setState(() {}),
                                  ),
                                ),
                                Form(
                                  key: _formKeys[1],
                                  child: ContactStep(
                                    draft: _draft,
                                    onChanged: () => setState(() {}),
                                  ),
                                ),
                                Form(
                                  key: _formKeys[2],
                                  child: AssociationStep(
                                    draft: _draft,
                                    options: options,
                                    onChanged: () => setState(() {}),
                                  ),
                                ),
                                Form(
                                  key: _formKeys[3],
                                  child: LocationStep(
                                    draft: _draft,
                                    options: options,
                                    onChanged: () => setState(() {}),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  _Controls(
                    canGoBack: _step > 0 && !_saving,
                    saving: _saving,
                    isLast: isLast,
                    onBack: () => setState(() => _step--),
                    onNext: _saving ? null : _next,
                  ),
                ],
              ),
      ),
    );
  }
}

class _Controls extends StatelessWidget {
  const _Controls({
    required this.canGoBack,
    required this.saving,
    required this.isLast,
    required this.onBack,
    required this.onNext,
  });

  final bool canGoBack;
  final bool saving;
  final bool isLast;
  final VoidCallback onBack;
  final VoidCallback? onNext;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: Theme.of(context).dividerColor)),
      ),
      child: Row(
        children: [
          if (canGoBack)
            Expanded(
              child: OutlinedButton(
                onPressed: onBack,
                child: const Text('Back'),
              ),
            ),
          if (canGoBack) const SizedBox(width: 12),
          Expanded(
            flex: 2,
            child: FilledButton(
              onPressed: onNext,
              child: saving
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2.5),
                    )
                  : Text(isLast ? 'Submit application' : 'Next'),
            ),
          ),
        ],
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.error_outline,
              size: 40,
              color: Theme.of(context).colorScheme.error,
            ),
            const SizedBox(height: 16),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 20),
            OutlinedButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Try again'),
            ),
          ],
        ),
      ),
    );
  }
}
