import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// The app's own preferences. One today: the language.
///
/// Backed by `flutter_secure_storage` like [TokenStore], and not because a
/// language code is a secret. It is the only store this app has, and adding
/// `shared_preferences` to persist a two-letter string would widen a
/// dependency list the pubspec deliberately keeps short. The cost is a
/// keystore round trip at launch, which is a fraction of the `.env` read
/// already happening beside it.
///
/// Every read is wrapped: a store that throws must not stop the app starting,
/// it must only mean "no choice recorded yet", which is a state the app
/// already has to handle on a first run.
class SettingsStore {
  SettingsStore({FlutterSecureStorage? storage})
    : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  static const _languageKey = 'member.languageCode';

  /// The stored language code, or null when nobody has chosen one.
  ///
  /// Null is what makes the language screen appear, so an unreadable store
  /// asks again rather than guessing - a question is recoverable, a wrong
  /// guess the person cannot undo is not.
  Future<String?> readLanguage() async {
    try {
      final value = await _storage.read(key: _languageKey);
      if (value == null || value.isEmpty) return null;
      return value;
    } catch (_) {
      return null;
    }
  }

  Future<void> saveLanguage(String languageCode) async {
    try {
      await _storage.write(key: _languageKey, value: languageCode);
    } catch (_) {
      // Not fatal: the app runs in the chosen language for this session and
      // asks again next launch. Failing the switch instead would leave
      // somebody stuck in a language they cannot read.
    }
  }
}
