import '../../../core/api/api_client.dart';
import 'member.dart';

/// What login and refresh return.
///
/// The server also sends a `csrfToken`, which is deliberately not kept: the
/// CSRF guards are not global -- they sit on four staff handlers only -- and
/// the member routes set no cookies at all, so there is nothing for one to
/// protect here.
class MemberAuthResult {
  const MemberAuthResult({
    required this.member,
    required this.accessToken,
    required this.refreshToken,
  });

  final Member member;
  final String accessToken;
  final String refreshToken;

  factory MemberAuthResult.fromJson(Map<String, dynamic> json) =>
      MemberAuthResult(
        member: Member.fromJson(json['member'] as Map<String, dynamic>),
        accessToken: json['accessToken'] as String,
        refreshToken: json['refreshToken'] as String,
      );
}

/// `member/auth/*`.
class AuthApi {
  AuthApi(this._client);

  final ApiClient _client;

  /// Signs in with a membership number and password.
  ///
  /// Needs `Origin`: the server scopes the lookup to the association that
  /// hostname resolves to, because a membership number is unique per business
  /// rather than globally.
  ///
  /// Throttled at 5/minute server-side.
  Future<MemberAuthResult> login({
    required String memberIdNumber,
    required String password,
  }) async {
    final json = await _client.post(
      '/member/auth/login',
      body: {'memberIdNumber': memberIdNumber, 'password': password},
      origin: true,
    );
    return MemberAuthResult.fromJson(json as Map<String, dynamic>);
  }

  /// Swaps a refresh token for a new pair.
  ///
  /// The server ROTATES: the presented token is revoked as the new one is
  /// issued, so the caller must store what comes back or the next attempt
  /// presents a dead token.
  Future<MemberAuthResult> refresh(String refreshToken) async {
    final json = await _client.post(
      '/member/auth/refresh',
      body: {'refreshToken': refreshToken},
    );
    return MemberAuthResult.fromJson(json as Map<String, dynamic>);
  }

  Future<Member> me() async {
    final json = await _client.get('/member/auth/me', auth: true);
    return Member.fromJson(json as Map<String, dynamic>);
  }

  /// Revokes this device's session.
  ///
  /// The token is sent so only THIS session dies. Omitting it revokes every
  /// session the member has, which is not what a sign-out button means.
  Future<void> logout(String? refreshToken) async {
    await _client.post(
      '/member/auth/logout',
      body: {'refreshToken': refreshToken},
      auth: true,
    );
  }
}
