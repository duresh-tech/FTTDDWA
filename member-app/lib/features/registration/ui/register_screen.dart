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
/// The photo IS collected now: it uploads on selection to
/// `POST public/member/photo`, and only the returned path travels with the
/// form.
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

  /// One line per step. The console's form carries the same explanatory text
  /// under each section heading, and on a phone - where only one step is ever
  /// on screen - it matters more, not less.
  static const _blurbs = [
    'Your name, date of birth and photo.',
    'How the association reaches you, and the password you will sign in with.',
    'What you do, and the position you are applying for.',
    'Where your business is, for your district association.',
  ];

  final _draft = ApplicationDraft();
  final _scroll = ScrollController();
  // One form per step, so Next validates only what is on screen.
  final _formKeys = List.generate(4, (_) => GlobalKey<FormState>());

  late final RegistrationApi _api = RegistrationApi(widget.session.client);

  MemberOptions? _options;
  String? _loadError;
  int _step = 0;
  bool _saving = false;
  bool _photoUploading = false;

  /// Uploads the picked photo and keeps only the path.
  ///
  /// Its own request, before submit: the image dwarfs the rest of the
  /// application and a failed submit should not mean taking it again. A
  /// failure is reported and leaves the field empty - the photo is optional,
  /// so it must never block the application.
  Future<void> _uploadPhoto(List<int> bytes, String filename) async {
    setState(() => _photoUploading = true);
    try {
      final path = await _api.uploadPhoto(bytes: bytes, filename: filename);
      if (!mounted) return;
      setState(() => _draft.passportPhotoPath = path);
    } on ApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
    } finally {
      if (mounted) setState(() => _photoUploading = false);
    }
  }

  @override
  void initState() {
    super.initState();
    _loadOptions();
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
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
      _toTop();
    } else {
      _submit();
    }
  }

  /// Puts the next step's first field on screen.
  ///
  /// One scroll view serves all four steps, so without this somebody who
  /// filled step 1 to the bottom arrives at step 2 already scrolled past its
  /// heading and first fields.
  void _toTop() {
    if (!_scroll.hasClients) return;
    _scroll.animateTo(
      0,
      duration: const Duration(milliseconds: 220),
      curve: Curves.easeOut,
    );
  }

  /// Leaves the form, confirming first if anything was typed.
  ///
  /// `_draft` is held by this State, so popping discards it - worth one
  /// question when somebody is three steps in.
  Future<void> _cancel() async {
    if (_draft.isEmpty) {
      Navigator.of(context).pop();
      return;
    }
    final leave = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Discard this application?'),
        content: const Text('What you have filled in will not be kept.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Keep filling it in'),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Discard'),
          ),
        ],
      ),
    );
    if (leave == true && mounted) Navigator.of(context).pop();
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

  /// The four steps, all mounted, only the current one occupying space.
  List<Widget> _steps(MemberOptions options) {
    final forms = [
      Form(
        key: _formKeys[0],
        child: IdentityStep(
          draft: _draft,
          onChanged: () => setState(() {}),
          onPhotoPicked: _uploadPhoto,
          photoUploading: _photoUploading,
        ),
      ),
      Form(
        key: _formKeys[1],
        child: ContactStep(draft: _draft, onChanged: () => setState(() {})),
      ),
      Form(
        key: _formKeys[2],
        child: AssociationStep(
          draft: _draft,
          options: options,
          onChanged: () => setState(() {}),
          fixedPositionId: widget.site.fixedPositionId,
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
    ];
    return [
      for (var i = 0; i < forms.length; i++)
        Offstage(offstage: i != _step, child: forms[i]),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final options = _options;
    final isLast = _step == _titles.length - 1;

    return Scaffold(
      appBar: AppBar(title: const Text('Apply for membership')),
      body: SafeArea(
        child: _loadError != null
            ? _ErrorState(message: _loadError!, onRetry: _loadOptions)
            : options == null
            ? const Center(child: CircularProgressIndicator())
            : Column(
                children: [
                  Expanded(
                    child: SingleChildScrollView(
                      controller: _scroll,
                      padding: const EdgeInsets.all(20),
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 520),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            _StepRail(titles: _titles, current: _step),
                            const SizedBox(height: 16),
                            Card(
                              child: Padding(
                                padding: const EdgeInsets.fromLTRB(
                                  16,
                                  16,
                                  16,
                                  4,
                                ),
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.stretch,
                                  children: [
                                    Text(
                                      _titles[_step],
                                      style: theme.textTheme.titleMedium
                                          ?.copyWith(
                                            fontWeight: FontWeight.bold,
                                          ),
                                    ),
                                    Padding(
                                      padding: const EdgeInsets.only(
                                        top: 2,
                                        bottom: 16,
                                      ),
                                      child: Text(
                                        _blurbs[_step],
                                        style: theme.textTheme.bodySmall
                                            ?.copyWith(
                                              color: theme
                                                  .colorScheme
                                                  .onSurfaceVariant,
                                            ),
                                      ),
                                    ),
                                    // All four steps stay in the tree so their
                                    // TextFormField state survives going back,
                                    // but only the current one takes up room.
                                    //
                                    // This was an IndexedStack, which sizes to
                                    // its TALLEST child - fine when the gap fell
                                    // below unframed fields, wrong now the step
                                    // sits in a card, where it showed as a tall
                                    // empty block on the two picker steps.
                                    // Offstage lays its child out but takes no
                                    // space, which is the behaviour wanted.
                                    ..._steps(options),
                                  ],
                                ),
                              ),
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
                    onBack: () {
                      setState(() => _step--);
                      _toTop();
                    },
                    onNext: _saving ? null : _next,
                    onCancel: _saving ? null : _cancel,
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
    required this.onCancel,
  });

  final bool canGoBack;
  final bool saving;
  final bool isLast;
  final VoidCallback onBack;
  final VoidCallback? onNext;

  /// Null while submitting - leaving mid-request would orphan the response.
  final VoidCallback? onCancel;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: Theme.of(context).dividerColor)),
      ),
      child: Row(
        children: [
          // On step 1 there is nothing to go back to, so the same slot is the
          // way out of the form - which the app previously did not offer at
          // all beyond the system back gesture.
          Expanded(
            child: canGoBack
                ? OutlinedButton(onPressed: onBack, child: const Text('Back'))
                : OutlinedButton(
                    onPressed: onCancel,
                    child: const Text('Cancel'),
                  ),
          ),
          const SizedBox(width: 12),
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

/// The four steps, named and numbered.
///
/// Replaces a 4px progress bar, which showed how far along somebody was
/// without ever saying what was still to come - on a form this long, knowing
/// there are two short steps left is the difference between finishing and
/// abandoning.
///
/// Each step owns an equal share of the width, and its connector is drawn as
/// two halves either side of the dot. That keeps the dots evenly spaced, which
/// is what lets a label sit centred under each one.
class _StepRail extends StatelessWidget {
  const _StepRail({required this.titles, required this.current});

  /// Short names, not the step headings: "Contact & sign-in" does not fit a
  /// quarter of a phone, and the card below already carries the full title.
  static const _short = ['Identity', 'Contact', 'Association', 'Location'];

  final List<String> titles;
  final int current;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: List.generate(titles.length, (index) {
        final done = index < current;
        final active = index == current;
        final reached = done || active;

        return Expanded(
          child: Column(
            children: [
              Row(
                children: [
                  Expanded(
                    child: _Connector(
                      // The left half belongs to the step BEFORE this one, so
                      // it fills as soon as this step is reached.
                      filled: reached,
                      visible: index > 0,
                    ),
                  ),
                  Container(
                    width: 26,
                    height: 26,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: reached
                          ? theme.colorScheme.primary
                          : theme.colorScheme.surfaceContainer,
                      border: Border.all(
                        color: reached
                            ? theme.colorScheme.primary
                            : theme.colorScheme.outlineVariant,
                      ),
                    ),
                    child: done
                        ? Icon(
                            Icons.check,
                            size: 15,
                            color: theme.colorScheme.onPrimary,
                          )
                        : Text(
                            '${index + 1}',
                            style: theme.textTheme.labelMedium?.copyWith(
                              fontWeight: FontWeight.w700,
                              color: active
                                  ? theme.colorScheme.onPrimary
                                  : theme.colorScheme.onSurfaceVariant,
                            ),
                          ),
                  ),
                  Expanded(
                    child: _Connector(
                      filled: done,
                      visible: index < titles.length - 1,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                _short[index],
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: theme.textTheme.labelSmall?.copyWith(
                  color: reached
                      ? theme.colorScheme.onSurface
                      : theme.colorScheme.onSurfaceVariant,
                  fontWeight: active ? FontWeight.w700 : FontWeight.w400,
                ),
              ),
            ],
          ),
        );
      }),
    );
  }
}

/// Half of the line between two dots. Invisible at the two ends, where it
/// still occupies space so every dot stays on its own quarter's centre.
class _Connector extends StatelessWidget {
  const _Connector({required this.filled, required this.visible});

  final bool filled;
  final bool visible;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      height: 2,
      margin: const EdgeInsets.symmetric(horizontal: 2),
      color: !visible
          ? Colors.transparent
          : filled
          ? theme.colorScheme.primary
          : theme.colorScheme.outlineVariant,
    );
  }
}
