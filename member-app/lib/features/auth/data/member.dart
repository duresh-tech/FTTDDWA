/// A name in both scripts, as every lookup on this API returns one.
///
/// The Tamil half is nullable everywhere -- a business may have recorded only
/// English -- so callers must treat it as optional, not merely empty.
class Bilingual {
  const Bilingual({required this.name, this.tamil, this.code});

  final String name;
  final String? tamil;

  /// Only RTOs carry one (`TN72`), and it is part of how a member is named.
  final String? code;

  /// Reads `{ <prefix>Name, <prefix>NameTamil }`, the shape every lookup uses.
  static Bilingual? from(Object? json, String prefix) {
    if (json is! Map) return null;
    final name = json['${prefix}Name'];
    if (name is! String) return null;
    return Bilingual(
      name: name,
      tamil: json['${prefix}NameTamil'] as String?,
      code: json['${prefix}Code'] as String?,
    );
  }

  /// `TN72 — Palladam`, or just the name when there is no code.
  String get labelled => code == null ? name : '$code — $name';
}

/// The member's own record, exactly as `GET member/auth/me` returns it.
///
/// Nothing here is editable: there is no endpoint for a member to change their
/// own details, by design. The field list mirrors the server's `PROFILE_SELECT`
/// and nothing has been added to it -- in particular there is no Aadhaar
/// number, only [aadhaarLast4]. The number itself never leaves the server, not
/// even to the person it belongs to.
class Member {
  const Member({
    required this.id,
    required this.systemCode,
    required this.memberIdNumber,
    required this.memberName,
    this.memberNameTamil,
    required this.businessName,
    this.businessNameTamil,
    required this.phoneNumber,
    this.whatsappNumber,
    required this.email,
    required this.addressLine1,
    this.addressLine2,
    required this.dateOfBirth,
    required this.isMarried,
    this.weddingDate,
    this.passportPhotoPath,
    required this.status,
    required this.createdAt,
    required this.aadhaarLast4,
    this.associationPosition,
    this.industry,
    this.state,
    this.district,
    this.taluk,
    this.rto,
  });

  final String id;
  final String systemCode;

  /// The membership number a card prints, e.g. `TN72001`. Also the login
  /// identity.
  final String memberIdNumber;

  final String memberName;
  final String? memberNameTamil;
  final String businessName;
  final String? businessNameTamil;
  final String phoneNumber;
  final String? whatsappNumber;
  final String email;
  final String addressLine1;
  final String? addressLine2;

  /// `YYYY-MM-DD`. A string on the wire, not an epoch -- unlike [createdAt].
  final String dateOfBirth;

  final bool isMarried;
  final String? weddingDate;

  /// A storage path, not a URL. Resolve it with `Env.uploadUrl`.
  final String? passportPhotoPath;

  final String status;

  /// UNIX seconds.
  final int createdAt;

  /// The last four digits only.
  final String aadhaarLast4;

  /// Note the key is `associationPosition`, not `position`.
  final Bilingual? associationPosition;
  final Bilingual? industry;
  final Bilingual? state;
  final Bilingual? district;
  final Bilingual? taluk;
  final Bilingual? rto;

  factory Member.fromJson(Map<String, dynamic> json) => Member(
    id: json['id'] as String,
    systemCode: json['systemCode'] as String? ?? '',
    memberIdNumber: json['memberIdNumber'] as String? ?? '',
    memberName: json['memberName'] as String? ?? '',
    memberNameTamil: json['memberNameTamil'] as String?,
    businessName: json['businessName'] as String? ?? '',
    businessNameTamil: json['businessNameTamil'] as String?,
    phoneNumber: json['phoneNumber'] as String? ?? '',
    whatsappNumber: json['whatsappNumber'] as String?,
    email: json['email'] as String? ?? '',
    addressLine1: json['addressLine1'] as String? ?? '',
    addressLine2: json['addressLine2'] as String?,
    dateOfBirth: json['dateOfBirth'] as String? ?? '',
    isMarried: json['isMarried'] as bool? ?? false,
    weddingDate: json['weddingDate'] as String?,
    passportPhotoPath: json['passportPhotoPath'] as String?,
    status: json['status'] as String? ?? 'ACTIVE',
    // BigInt columns arrive as JSON numbers: main.ts patches
    // BigInt.prototype.toJSON on the server.
    createdAt: (json['createdAt'] as num?)?.toInt() ?? 0,
    aadhaarLast4: json['aadhaarLast4'] as String? ?? '',
    associationPosition: Bilingual.from(
      json['associationPosition'],
      'position',
    ),
    industry: Bilingual.from(json['industry'], 'industry'),
    state: Bilingual.from(json['state'], 'state'),
    district: Bilingual.from(json['district'], 'district'),
    taluk: Bilingual.from(json['taluk'], 'taluk'),
    rto: Bilingual.from(json['rto'], 'rto'),
  );

  /// `•••• •••• 1234`, the only form of the Aadhaar that exists client-side.
  String get maskedAadhaar =>
      aadhaarLast4.isEmpty ? '' : '•••• •••• $aadhaarLast4';
}
