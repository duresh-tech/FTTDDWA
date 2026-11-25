import 'package:flutter/material.dart';
import 'package:open_filex/open_filex.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/config/env.dart';
import '../../../shared/widgets/bilingual_row.dart';
import '../../auth/data/member.dart';
import '../../auth/member_session.dart';
import '../../auth/ui/login_screen.dart';
import '../../registration/data/options.dart';
import '../data/id_card.dart';
import '../data/profile_api.dart';
import 'widgets/card_panel.dart';

/// The member's own record.
///
/// Every value here comes from `GET member/auth/me`, resolved from the token.
/// There is no member id anywhere in this screen, which is what makes it
/// impossible to ask for somebody else's -- no route takes one.
///
/// Nothing is editable: there is no endpoint for a member to change their own
/// details, by design.
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key, required this.session, required this.site});

  final MemberSession session;
  final PublicSite site;

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  late final ProfileApi _api = ProfileApi(widget.session.client);

  Member? _member;
  String? _loadError;

  IdCard? _card;
  bool _cardLoading = true;

  bool _downloading = false;
  bool _signingOut = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  /// Loads the member, then the card.
  ///
  /// This is also where a restored-but-dead session is discovered. The splash
  /// deliberately does not verify tokens, so the first real call does it: the
  /// client refreshes once on a 401 and, if that fails too, the session is
  /// gone and we route to login.
  Future<void> _load() async {
    setState(() => _loadError = null);
    try {
      final member = await widget.session.loadMember();
      if (!mounted) return;
      setState(() => _member = member);
    } on ApiException catch (error) {
      if (!mounted) return;
      if (!widget.session.hasTokens) {
        // Refresh failed and the session was discarded. Back to login.
        _toLogin();
        return;
      }
      setState(() => _loadError = error.message);
      return;
    }

    try {
      final card = await _api.currentCard();
      if (!mounted) return;
      setState(() {
        _card = card;
        _cardLoading = false;
      });
    } on ApiException {
      // The record is the point of this screen and the card is an extra, so a
      // card failure must not take the whole page down.
      if (mounted) setState(() => _cardLoading = false);
    }
  }

  Future<void> _download() async {
    setState(() => _downloading = true);
    try {
      final path = await _api.downloadCard(
        filenameHint: _member?.memberIdNumber ?? 'membership-card',
      );
      final result = await OpenFilex.open(path);
      if (!mounted) return;
      if (result.type != ResultType.done) {
        // Saved, but nothing on the device claims PDFs. Say where it went
        // rather than reporting a failure that did not happen.
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Saved to $path')));
      }
    } on ApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
    } finally {
      if (mounted) setState(() => _downloading = false);
    }
  }

  Future<void> _signOut() async {
    setState(() => _signingOut = true);
    await widget.session.logout();
    if (!mounted) return;
    _toLogin();
  }

  void _toLogin() {
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (_) => LoginScreen(session: widget.session, site: widget.site),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final member = _member;

    if (_loadError != null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Your membership')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.cloud_off, size: 40, color: theme.colorScheme.error),
                const SizedBox(height: 16),
                Text(_loadError!, textAlign: TextAlign.center),
                const SizedBox(height: 20),
                OutlinedButton.icon(
                  onPressed: _load,
                  icon: const Icon(Icons.refresh),
                  label: const Text('Try again'),
                ),
                const SizedBox(height: 8),
                TextButton(onPressed: _signOut, child: const Text('Sign out')),
              ],
            ),
          ),
        ),
      );
    }

    if (member == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.site.shortName ?? 'Your membership'),
        actions: [
          IconButton(
            tooltip: 'Sign out',
            onPressed: _signingOut ? null : _signOut,
            icon: _signingOut
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.logout),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _Header(member: member),
            const SizedBox(height: 16),
            CardPanel(
              card: _card,
              loading: _cardLoading,
              downloading: _downloading,
              onDownload: _download,
            ),
            const SizedBox(height: 16),

            Card(
              margin: EdgeInsets.zero,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 14, 16, 6),
                    child: Text(
                      'Your details',
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  // Each row renders nothing when it has no value, so this is
                  // a list of what is actually recorded rather than a grid of
                  // dashes.
                  BilingualRow(
                    label: 'Name',
                    value: member.memberName,
                    tamil: member.memberNameTamil,
                  ),
                  BilingualRow(
                    label: 'Business',
                    value: member.businessName,
                    tamil: member.businessNameTamil,
                  ),
                  BilingualRow(
                    label: 'Position',
                    value: member.associationPosition?.name,
                    tamil: member.associationPosition?.tamil,
                  ),
                  BilingualRow(
                    label: 'Trade',
                    value: member.industry?.name,
                    tamil: member.industry?.tamil,
                  ),
                  BilingualRow(label: 'Phone', value: member.phoneNumber),
                  BilingualRow(label: 'WhatsApp', value: member.whatsappNumber),
                  BilingualRow(label: 'Email', value: member.email),
                  BilingualRow(
                    label: 'Date of birth',
                    value: member.dateOfBirth,
                  ),
                  if (member.isMarried)
                    BilingualRow(
                      label: 'Wedding date',
                      value: member.weddingDate,
                    ),
                  BilingualRow(label: 'Aadhaar', value: member.maskedAadhaar),
                  BilingualRow(
                    label: 'Address',
                    value: [
                      member.addressLine1,
                      member.addressLine2,
                    ].where((p) => p != null && p.isNotEmpty).join(', '),
                  ),
                  BilingualRow(
                    label: 'Taluk',
                    value: member.taluk?.name,
                    tamil: member.taluk?.tamil,
                  ),
                  BilingualRow(
                    label: 'District',
                    value: member.district?.name,
                    tamil: member.district?.tamil,
                  ),
                  BilingualRow(
                    label: 'State',
                    value: member.state?.name,
                    tamil: member.state?.tamil,
                  ),
                  BilingualRow(
                    label: 'RTO',
                    value: member.rto?.labelled,
                    tamil: member.rto?.tamil,
                  ),
                  const SizedBox(height: 6),
                ],
              ),
            ),

            const SizedBox(height: 20),
            Text(
              'Something wrong? Contact your association — members cannot edit '
              'their own record here.',
              textAlign: TextAlign.center,
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.member});

  final Member member;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final photo = member.passportPhotoPath;

    return Row(
      children: [
        if (photo != null)
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Image.network(
              Env.uploadUrl(photo),
              width: 60,
              height: 60,
              fit: BoxFit.cover,
              errorBuilder: (_, _, _) => _placeholder(theme),
            ),
          )
        else
          _placeholder(theme),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                member.memberName,
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              if (member.memberNameTamil != null)
                Text(
                  member.memberNameTamil!,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              const SizedBox(height: 2),
              Text(
                member.memberIdNumber,
                style: theme.textTheme.bodyMedium?.copyWith(
                  letterSpacing: 1.2,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
        Chip(label: Text(member.status), visualDensity: VisualDensity.compact),
      ],
    );
  }

  Widget _placeholder(ThemeData theme) => Container(
    width: 60,
    height: 60,
    decoration: BoxDecoration(
      color: theme.colorScheme.primary,
      borderRadius: BorderRadius.circular(12),
    ),
    child: Icon(
      Icons.person_outline,
      size: 30,
      color: theme.colorScheme.onPrimary,
    ),
  );
}
