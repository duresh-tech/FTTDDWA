import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';

import 'app.dart';
import 'features/auth/member_session.dart';

/// Loads configuration, then runs.
///
/// Only `.env` is awaited here, and it is a bundled asset rather than a
/// network call -- so this adds a file read, not a round trip. Everything
/// else, including restoring a stored session, happens on the splash where it
/// has a screen to happen on.
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await dotenv.load(fileName: '.env');
  runApp(App(session: MemberSession()));
}
