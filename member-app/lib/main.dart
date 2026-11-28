import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';

import 'app.dart';
import 'core/storage/settings_store.dart';
import 'features/auth/member_session.dart';

/// Loads configuration, then runs.
///
/// Two reads, both local: the bundled `.env`, and the stored language. Neither
/// is a round trip, and the language has to be known BEFORE the first frame or
/// the app paints in English and then repaints in Tamil, which reads as a bug.
///
/// Everything else, including restoring a stored session, happens on the
/// splash where it has a screen to happen on.
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await dotenv.load(fileName: '.env');

  final settings = SettingsStore();
  final language = await settings.readLanguage();

  runApp(
    App(
      session: MemberSession(),
      settings: settings,
      initialLanguage: language,
    ),
  );
}
