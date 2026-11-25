/// The member's current ID card, as `GET member/id-card` returns it.
///
/// Cards are a HISTORY -- one row per issue -- but a member only ever sees the
/// one that is current. A superseded or revoked card stays in the history for
/// staff; it is not something the member is entitled to hold.
///
/// There is no `filePath` here, deliberately: the server does not expose one,
/// and the download is a separate guarded stream rather than a URL that could
/// be shared.
class IdCard {
  const IdCard({
    required this.id,
    required this.systemCode,
    required this.issueNumber,
    required this.issuedAt,
    this.expiryAt,
    required this.status,
    required this.expired,
    required this.fileSizeBytes,
  });

  final String id;
  final String systemCode;

  /// 1-based per member: "issue 3 of this member's card".
  final int issueNumber;

  /// UNIX seconds.
  final int issuedAt;

  /// UNIX seconds, or null when the association sets no validity period.
  final int? expiryAt;

  /// Always `ACTIVE` here -- the endpoint returns no other.
  final String status;

  /// COMPUTED by the server from [expiryAt] and the clock, never stored.
  ///
  /// There is no `EXPIRED` status on purpose: storing expiry beside a date
  /// gives two sources of truth that drift, and a card would sit
  /// stale-`ACTIVE` past its date with no job to sweep it.
  final bool expired;

  final int fileSizeBytes;

  factory IdCard.fromJson(Map<String, dynamic> json) => IdCard(
    id: json['id'] as String,
    systemCode: json['systemCode'] as String? ?? '',
    issueNumber: (json['issueNumber'] as num?)?.toInt() ?? 1,
    issuedAt: (json['issuedAt'] as num?)?.toInt() ?? 0,
    expiryAt: (json['expiryAt'] as num?)?.toInt(),
    status: json['status'] as String? ?? 'ACTIVE',
    expired: json['expired'] as bool? ?? false,
    fileSizeBytes: (json['fileSizeBytes'] as num?)?.toInt() ?? 0,
  );

  DateTime get issuedOn => DateTime.fromMillisecondsSinceEpoch(issuedAt * 1000);

  DateTime? get expiresOn => expiryAt == null
      ? null
      : DateTime.fromMillisecondsSinceEpoch(expiryAt! * 1000);
}
