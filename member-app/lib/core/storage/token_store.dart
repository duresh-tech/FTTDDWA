import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// The member's tokens, in the platform keystore.
///
/// Not `SharedPreferences`: the refresh token is a bearer credential good for
/// seven days, and on a rooted or jailbroken device plain preferences are a
/// file. The Android keystore and the iOS keychain are what these are for.
///
/// Every read is defensive. Secure storage can throw -- a restored backup on
/// Android can leave an entry undecryptable -- and the right answer to that is
/// "no session", not a crash on launch.
class TokenStore {
  /// The defaults are deliberately left alone.
  ///
  /// On v11 the default Android options are already AES-GCM with RSA key
  /// wrapping in the keystore, and `resetOnError` already defaults to true --
  /// which is exactly the handling an undecryptable entry needs. Naming them
  /// explicitly would only risk pinning a weaker set later.
  TokenStore({FlutterSecureStorage? storage})
    : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  static const _accessKey = 'member.accessToken';
  static const _refreshKey = 'member.refreshToken';

  Future<String?> readAccess() => _read(_accessKey);
  Future<String?> readRefresh() => _read(_refreshKey);

  /// Stores a token pair, replacing whatever was there.
  ///
  /// Both are written together because the server rotates them together: a
  /// stored pair where one half is stale is worse than none.
  Future<void> save({required String access, required String refresh}) async {
    try {
      await _storage.write(key: _accessKey, value: access);
      await _storage.write(key: _refreshKey, value: refresh);
    } catch (_) {
      // Nothing useful to do. The session still works for this run; it just
      // will not survive a restart.
    }
  }

  Future<void> clear() async {
    try {
      await _storage.delete(key: _accessKey);
      await _storage.delete(key: _refreshKey);
    } catch (_) {
      // Ignored deliberately -- see the class comment.
    }
  }

  Future<String?> _read(String key) async {
    try {
      return await _storage.read(key: key);
    } catch (_) {
      return null;
    }
  }
}
