import 'package:flutter_dotenv/flutter_dotenv.dart';

/// Configuration, read from the bundled `.env`.
///
/// These are BUILD-time values. `flutter_dotenv` loads an asset baked into the
/// binary, so unlike `console/.env` -- which a running server re-reads -- one
/// build serves one association. See `.env.example`.
///
/// Every getter is lazy. Nothing here runs before `dotenv.load()` in main().
class Env {
  const Env._();

  /// The REST API, absolute and including the `/api/v1` prefix.
  static String get apiUrl => _require('APP_API_URL');

  /// The association's hostname, e.g. `acme.example.com`.
  static String get associationHost => _require('APP_ASSOCIATION_HOST');

  /// This app's API key, sent as `x-api-key`.
  ///
  /// It cannot ride in `Authorization: Bearer` -- the member's JWT occupies
  /// that header, and the guard only reads a key from there when the value
  /// starts with the key brand.
  static String get apiKey => _require('APP_API_KEY');

  static String get appName {
    final value = dotenv.env['APP_NAME']?.trim();
    return (value == null || value.isEmpty) ? 'Membership' : value;
  }

  /// The `Origin` header the API resolves the association from.
  ///
  /// This is the whole reason a native client works at all. The API takes the
  /// business from the hostname and accepts no business id in any request body,
  /// and `SiteService.hostOf` reads `Origin` before `X-Forwarded-Host` before
  /// the `Host` header -- so an app reaching the API at any address can still
  /// name the association it serves. The scheme is stripped server-side, so it
  /// does not have to match how the API is actually reached.
  static String get origin => 'https://$associationHost';

  /// Base URL for stored files: the API URL without its `/api/vN` suffix.
  ///
  /// `/uploads` is served by `app.useStaticAssets()`, OUTSIDE the guard
  /// pipeline, so an image needs no key, no token and no device header. That
  /// is what lets a plain `Image.network` work.
  static String get uploadsBase =>
      apiUrl.replaceFirst(RegExp(r'/api/v\d+/?$'), '');

  /// Resolves a stored path (`logos/x.png`) to a fetchable URL.
  static String uploadUrl(String path) {
    final clean = path.startsWith('/') ? path.substring(1) : path;
    return '$uploadsBase/uploads/$clean';
  }

  static String _require(String key) {
    final value = dotenv.env[key]?.trim();
    if (value == null || value.isEmpty) {
      // Loud on purpose. A missing value here produces 404s and 401s that look
      // like server faults, so it is worth naming the real cause.
      throw StateError(
        'Missing $key in member-app/.env. Copy .env.example to .env and fill it in.',
      );
    }
    return value;
  }
}
