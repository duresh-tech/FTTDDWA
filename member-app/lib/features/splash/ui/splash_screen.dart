import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/config/env.dart';
import '../../../core/theme/app_theme.dart';
import '../../../l10n/app_localizations.dart';
import '../../auth/member_session.dart';
import '../../auth/ui/login_screen.dart';
import '../../profile/ui/profile_screen.dart';
import '../../registration/data/options.dart';
import '../../registration/data/registration_api.dart';

/// The branded launch screen.
///
/// It asks for nothing. Everything it needs is in `.env`, so this is a brand
/// moment plus two pieces of preparation -- not a setup step.
///
/// The rule it is built around: **it never blocks on the network.** The site
/// fetch is only branding and a button, so it runs under a short timeout and
/// the app proceeds either way. A splash that waits forever on a bad network
/// is the classic version of this screen done wrong.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key, required this.session});

  final MemberSession session;

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  /// Long enough to read the name, short enough not to be a wait.
  static const _minimumOnScreen = Duration(milliseconds: 600);

  /// Branding is optional, so it gets a short leash.
  static const _siteTimeout = Duration(seconds: 3);

  String? _fatal;

  @override
  void initState() {
    super.initState();
    _boot();
  }

  Future<void> _boot() async {
    setState(() => _fatal = null);
    final started = DateTime.now();

    PublicSite site = PublicSite.empty;
    try {
      // Reading .env happens on first touch of Env, so a missing or malformed
      // file surfaces here rather than as a mystery 404 later.
      final api = RegistrationApi(widget.session.client);

      // Both start together: the session restore is a disk read and has no
      // reason to queue behind a request.
      final restoring = widget.session.restore();
      final fetching = api.site(timeout: _siteTimeout).catchError((Object e) {
        // Branding failing is not a reason to keep anyone out. The login
        // screen falls back to APP_NAME and still signs people in.
        debugPrint('member-app: could not load site details: $e');
        return PublicSite.empty;
      });

      await restoring;
      site = await fetching;
    } on StateError catch (error) {
      // A configuration fault: .env missing a value. Nothing works until it is
      // fixed, so this one does stop here.
      if (mounted) setState(() => _fatal = error.message);
      return;
    } on ApiException catch (error) {
      if (mounted) setState(() => _fatal = error.message);
      return;
    }

    // Wait out the remainder of the minimum, rather than blinking past.
    final elapsed = DateTime.now().difference(started);
    if (elapsed < _minimumOnScreen) {
      await Future<void>.delayed(_minimumOnScreen - elapsed);
    }
    if (!mounted) return;

    // Tokens, not a loaded member: the profile screen does that call itself,
    // with the client's refresh-and-retry behind it.
    final destination = widget.session.hasTokens
        ? ProfileScreen(session: widget.session, site: site)
        : LoginScreen(session: widget.session, site: site);

    await Navigator.of(
      context,
    ).pushReplacement(MaterialPageRoute(builder: (_) => destination));
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final l = L.of(context);

    // WHITE, not the header gradient it used to carry.
    //
    // The native splash Android draws before Flutter starts is white with
    // this same emblem on it. A gradient here meant the launch flashed white
    // then indigo in the first half second, which reads as a glitch. One
    // background across both, and the handover is invisible.
    return Scaffold(
      backgroundColor: Colors.white,
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Fades and scales in over the 600ms the splash is held for
              // anyway, so the pause reads as deliberate rather than slow.
              TweenAnimationBuilder<double>(
                tween: Tween(begin: 0, end: 1),
                duration: const Duration(milliseconds: 520),
                curve: Curves.easeOutCubic,
                builder: (context, t, child) => Opacity(
                  opacity: t.clamp(0, 1),
                  child: Transform.scale(
                    scale: 0.92 + (0.08 * t),
                    child: child,
                  ),
                ),
                child: Image.asset(
                  'assets/images/fttddwa-logo.webp',
                  width: 168,
                  height: 168,
                  fit: BoxFit.contain,
                ),
              ),
              const SizedBox(height: 16),
              Text(
                // Env may throw if .env is unusable, and this widget has to be
                // able to render the error that says so.
                _fatal == null ? _safeAppName() : l.configProblem,
                textAlign: TextAlign.center,
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: AppColors.lightForeground,
                ),
              ),
              const SizedBox(height: 28),
              if (_fatal == null)
                const SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(strokeWidth: 2.5),
                )
              else ...[
                Text(
                  _fatal!,
                  textAlign: TextAlign.center,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: AppColors.destructive,
                  ),
                ),
                const SizedBox(height: 20),
                OutlinedButton.icon(
                  onPressed: _boot,
                  icon: const Icon(Icons.refresh),
                  label: Text(l.tryAgain),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  String _safeAppName() {
    try {
      return Env.appName;
    } catch (_) {
      return 'Membership';
    }
  }
}
