import 'dart:convert';
import 'dart:io' show Platform;
import 'dart:typed_data';

import 'package:http/http.dart' as http;

import '../config/env.dart';
import 'api_exception.dart';

/// The one HTTP client the app uses.
///
/// It owns the four things every request to this API needs, so no screen has
/// to remember them:
///
/// - `x-device-type`, which a global guard requires on EVERY route
/// - `x-api-key`, which a global guard requires on every route but four
/// - `Origin`, which tells the API which association this app serves
/// - `Authorization`, and a single refresh-and-retry when it has expired
class ApiClient {
  ApiClient({http.Client? inner}) : _http = inner ?? http.Client();

  final http.Client _http;

  /// The current member's access token, or null when signed out.
  String? accessToken;

  /// Set by [MemberSession]. Returns true when a new access token is in hand.
  ///
  /// A callback rather than a direct dependency, so the client knows nothing
  /// about sessions and the session owns the tokens.
  Future<bool> Function()? onRefreshNeeded;

  /// `androidApp` / `iosApp`, the exact spellings the guard accepts.
  ///
  /// `ALLOWED_DEVICES` is checked with `Array.includes` and no normalisation,
  /// so these are case-sensitive: `android` is a 400, not a synonym.
  static String get deviceType => Platform.isIOS ? 'iosApp' : 'androidApp';

  Future<dynamic> get(
    String path, {
    bool auth = false,
    bool origin = false,
    Duration? timeout,
  }) => _send('GET', path, auth: auth, origin: origin, timeout: timeout);

  Future<dynamic> post(
    String path, {
    Object? body,
    bool auth = false,
    bool origin = false,
    Duration? timeout,
  }) => _send(
    'POST',
    path,
    body: body,
    auth: auth,
    origin: origin,
    timeout: timeout,
  );

  Future<dynamic> _send(
    String method,
    String path, {
    Object? body,
    bool auth = false,
    bool origin = false,
    Duration? timeout,
    bool retried = false,
  }) async {
    final uri = Uri.parse('${Env.apiUrl}$path');
    final request = http.Request(method, uri)
      ..headers.addAll(_headers(auth: auth, origin: origin));
    if (body != null) request.body = jsonEncode(body);

    http.Response response;
    try {
      var future = _http.send(request).then(http.Response.fromStream);
      if (timeout != null) future = future.timeout(timeout);
      response = await future;
    } catch (error) {
      throw ApiException.network(error);
    }

    // One refresh, then one retry. The server ROTATES the refresh token, so a
    // second concurrent attempt would present a token the first just revoked.
    if (response.statusCode == 401 &&
        auth &&
        !retried &&
        onRefreshNeeded != null) {
      if (await onRefreshNeeded!()) {
        return _send(
          method,
          path,
          body: body,
          auth: auth,
          origin: origin,
          timeout: timeout,
          retried: true,
        );
      }
    }

    final decoded = _decode(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException.fromBody(response.statusCode, decoded);
    }
    return decoded;
  }

  /// Fetches a binary body -- the member's card PDF.
  ///
  /// A plain download cannot reach it: the file lives in private storage
  /// behind a guard, so the request needs the token and the key like any
  /// other. Returns the bytes and the filename the server suggests.
  Future<({Uint8List bytes, String filename})> getBytes(
    String path, {
    required String fallbackFilename,
    bool retried = false,
  }) async {
    final uri = Uri.parse('${Env.apiUrl}$path');

    http.Response response;
    try {
      response = await _http.get(uri, headers: _headers(auth: true));
    } catch (error) {
      throw ApiException.network(error);
    }

    // `retried` bounds this at one attempt. Without it a server that keeps
    // answering 401 while refresh keeps succeeding would recurse forever.
    if (response.statusCode == 401 && !retried && onRefreshNeeded != null) {
      if (await onRefreshNeeded!()) {
        return getBytes(
          path,
          fallbackFilename: fallbackFilename,
          retried: true,
        );
      }
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      // An error on this route still answers in JSON, so read it that way to
      // surface the real message instead of "download failed".
      throw ApiException.fromBody(response.statusCode, _decode(response));
    }

    return (
      bytes: response.bodyBytes,
      filename:
          _filenameFrom(response.headers['content-disposition']) ??
          fallbackFilename,
    );
  }

  Map<String, String> _headers({bool auth = false, bool origin = false}) {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'x-device-type': deviceType,
      'x-api-key': Env.apiKey,
    };
    // Only the host-resolving routes need it -- login and public/member/*.
    // Everything else reads the business out of the JWT. Sending it anyway is
    // harmless, but asking for it explicitly documents which routes depend on
    // it.
    if (origin) headers['Origin'] = Env.origin;
    final token = accessToken;
    if (auth && token != null) headers['Authorization'] = 'Bearer $token';
    return headers;
  }

  /// Decodes a JSON body, tolerating an empty one.
  ///
  /// `GET member/id-card` answers 200 with a literal `null` when no card has
  /// been issued, which decodes to null and is a legitimate result -- not an
  /// error.
  dynamic _decode(http.Response response) {
    if (response.bodyBytes.isEmpty) return null;
    try {
      return jsonDecode(utf8.decode(response.bodyBytes));
    } catch (_) {
      return null;
    }
  }

  static String? _filenameFrom(String? disposition) {
    if (disposition == null) return null;
    final match = RegExp('filename="?([^";]+)"?').firstMatch(disposition);
    return match?.group(1);
  }

  void close() => _http.close();
}
