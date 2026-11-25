import 'package:flutter/foundation.dart';

import '../../core/api/api_client.dart';
import '../../core/api/api_exception.dart';
import '../../core/storage/token_store.dart';
import 'data/auth_api.dart';
import 'data/member.dart';

/// The signed-in member, and the only mutable state the app shares.
///
/// A `ChangeNotifier` and nothing more. The console's house style is a plain
/// form, one state object and a saving flag; this is the same instinct in
/// Flutter, and three screens give a state-management package nothing to do.
class MemberSession extends ChangeNotifier {
  MemberSession({ApiClient? client, TokenStore? tokens})
    : client = client ?? ApiClient(),
      _tokens = tokens ?? TokenStore() {
    api = AuthApi(this.client);
    // Lets the client recover from one expired access token without every
    // caller handling 401. Wired here because the session owns the tokens.
    this.client.onRefreshNeeded = _refresh;
  }

  final ApiClient client;
  final TokenStore _tokens;
  late final AuthApi api;

  Member? _member;
  String? _refreshToken;

  /// The member's record, once loaded. Null until [loadMember] succeeds.
  Member? get member => _member;

  /// Whether there are stored tokens worth trying.
  ///
  /// Deliberately NOT the same as having a [member]: after a cold start there
  /// are tokens but no record, and the profile screen is what turns one into
  /// the other.
  bool get hasTokens => _refreshToken != null;

  /// Restores stored tokens. LOCAL ONLY -- no network, so the splash can await
  /// this without a round trip.
  ///
  /// It does not verify them. A stored access token may well have expired
  /// while the app was closed, and finding that out costs a request; the
  /// profile screen's first call does it instead, and the client's
  /// refresh-and-retry handles the 401 invisibly. That keeps the splash the
  /// length of a disk read rather than the length of a network timeout.
  Future<void> restore() async {
    final refresh = await _tokens.readRefresh();
    if (refresh == null || refresh.isEmpty) return;
    _refreshToken = refresh;
    client.accessToken = await _tokens.readAccess();
  }

  /// Loads the member's own record from the token.
  ///
  /// Throws [ApiException] when the session is no longer good -- revoked,
  /// expired, or a membership that is no longer ACTIVE. The caller routes to
  /// login; the strategy re-reads the member on every request, so this is the
  /// authoritative check.
  Future<Member> loadMember() async {
    final member = await api.me();
    _member = member;
    notifyListeners();
    return member;
  }

  Future<void> login({
    required String memberIdNumber,
    required String password,
  }) async {
    final result = await api.login(
      memberIdNumber: memberIdNumber,
      password: password,
    );
    await _accept(result);
  }

  Future<void> logout() async {
    try {
      await api.logout(_refreshToken);
    } on ApiException {
      // A failed revoke must not trap the member in a signed-in UI. The local
      // tokens go either way, and the server-side row expires on its own.
    }
    await discard();
  }

  /// Exchanges the refresh token for a new pair.
  ///
  /// Called by the client on a 401, at most once per request. The server
  /// ROTATES -- the presented token is revoked as the new one is issued -- so
  /// what comes back must replace what is stored, or the next attempt presents
  /// a dead token.
  ///
  /// Concurrent callers share ONE exchange. Two requests that both 401 would
  /// otherwise both refresh, and the second would present the token the first
  /// had just had revoked -- failing, and signing the member out in the middle
  /// of a working session.
  Future<bool> _refresh() {
    return _inFlightRefresh ??= _performRefresh().whenComplete(
      () => _inFlightRefresh = null,
    );
  }

  Future<bool>? _inFlightRefresh;

  Future<bool> _performRefresh() async {
    final stored = _refreshToken;
    if (stored == null) return false;
    try {
      final result = await api.refresh(stored);
      await _accept(result);
      return true;
    } on ApiException {
      await discard();
      return false;
    }
  }

  Future<void> _accept(MemberAuthResult result) async {
    _member = result.member;
    _refreshToken = result.refreshToken;
    client.accessToken = result.accessToken;
    await _tokens.save(
      access: result.accessToken,
      refresh: result.refreshToken,
    );
    notifyListeners();
  }

  /// Drops the session locally, without telling the server.
  Future<void> discard() async {
    _member = null;
    _refreshToken = null;
    client.accessToken = null;
    await _tokens.clear();
    notifyListeners();
  }
}
