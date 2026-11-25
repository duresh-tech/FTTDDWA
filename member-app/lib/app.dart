import 'package:flutter/material.dart';

import 'core/config/env.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/member_session.dart';
import 'features/splash/ui/splash_screen.dart';

class App extends StatelessWidget {
  const App({super.key, required this.session});

  final MemberSession session;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      // The association's own name replaces this once the splash has fetched
      // it; this is what the OS task switcher shows in the meantime.
      title: Env.appName,
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      home: SplashScreen(session: session),
    );
  }
}
