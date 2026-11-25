import 'dart:io';

import 'package:path_provider/path_provider.dart';

import '../../../core/api/api_client.dart';
import 'id_card.dart';

/// `member/id-card`.
///
/// Neither route takes a card id or a member id: both resolve the card from
/// the TOKEN's member. That is what makes it impossible to ask for somebody
/// else's -- there is no identifier to tamper with.
class ProfileApi {
  ProfileApi(this._client);

  final ApiClient _client;

  /// The member's current card, or null when none has been issued.
  ///
  /// `null` is a 200 with a literal `null` body, not an error: most members
  /// will have no card until the association issues one.
  Future<IdCard?> currentCard() async {
    final json = await _client.get('/member/id-card', auth: true);
    if (json == null) return null;
    return IdCard.fromJson(json as Map<String, dynamic>);
  }

  /// Downloads the card PDF and writes it where the OS can open it.
  ///
  /// The temporary directory, not documents: this is a convenience copy of a
  /// file the association holds, and re-downloading is free. Returns the path
  /// for the caller to hand to the platform viewer.
  Future<String> downloadCard({required String filenameHint}) async {
    final result = await _client.getBytes(
      '/member/id-card/download',
      fallbackFilename: '$filenameHint.pdf',
    );

    final dir = await getTemporaryDirectory();
    final file = File('${dir.path}/${result.filename}');
    await file.writeAsBytes(result.bytes, flush: true);
    return file.path;
  }
}
