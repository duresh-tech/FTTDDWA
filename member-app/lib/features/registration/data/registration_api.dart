import '../../../core/api/api_client.dart';
import 'application_draft.dart';
import 'options.dart';

/// `public/member/*`.
///
/// These three are the API's only `@SkipApiKey()` member routes, so they work
/// without a key -- the app sends one anyway, because one code path is simpler
/// than two and a valid key is never wrong.
///
/// All three resolve the association from the hostname, so all three send
/// `Origin`. Without it they return 404 "This address does not serve a member
/// portal", which is also exactly what a wrong APP_ASSOCIATION_HOST looks
/// like.
class RegistrationApi {
  RegistrationApi(this._client);

  final ApiClient _client;

  /// The association's public details, and whether it accepts applications.
  ///
  /// [timeout] is passed by the splash, which must not hang on a slow network:
  /// branding is a nicety and signing in is not.
  Future<PublicSite> site({Duration? timeout}) async {
    final json = await _client.get(
      '/public/member/site',
      origin: true,
      timeout: timeout,
    );
    return PublicSite.fromJson(json as Map<String, dynamic>);
  }

  /// The six lookup lists the form's pickers need, ACTIVE only.
  Future<MemberOptions> options() async {
    final json = await _client.get('/public/member/options', origin: true);
    return MemberOptions.fromJson(json as Map<String, dynamic>);
  }

  /// Uploads the applicant's photo and returns its storage PATH.
  ///
  /// Its own request, before the form is submitted: the image dwarfs the rest
  /// of the application, and a failed submit should not mean taking the photo
  /// again. The path comes back short enough to carry in the draft.
  ///
  /// The server caps the size at 2 MB, reads the type from the file's own
  /// leading bytes rather than anything the client declares, and throttles
  /// this at 5/minute - so the checks on the app side are a courtesy that
  /// saves a round trip, never the control.
  Future<String> uploadPhoto({
    required List<int> bytes,
    required String filename,
  }) async {
    final json = await _client.postFile(
      '/public/member/photo',
      field: 'file',
      bytes: bytes,
      filename: filename,
      origin: true,
    );
    return (json as Map<String, dynamic>)['path'] as String;
  }

  /// Files an application.
  ///
  /// Writes to `tenant_member_applications`, never to the member register:
  /// this creates no member, no session and nothing to sign in with. Throttled
  /// at 5/minute, and refused with 403 when the association has registration
  /// turned off.
  Future<SubmittedApplication> apply(ApplicationDraft draft) async {
    final json = await _client.post(
      '/public/member/apply',
      body: draft.toJson(),
      origin: true,
    );
    return SubmittedApplication.fromJson(json as Map<String, dynamic>);
  }
}
