/// The registration form's single mutable state object.
///
/// One object across four steps rather than a model per step, so a member can
/// go back and forth without anything being rebuilt or lost. This mirrors the
/// console's pattern: one state object, mutated in place, read on submit.
class ApplicationDraft {
  // Step 1 -- identity
  String memberName = '';
  String memberNameTamil = '';
  String businessName = '';
  String businessNameTamil = '';
  String dateOfBirth = '';
  bool isMarried = false;
  String weddingDate = '';
  String aadhaarNumber = '';

  // Step 2 -- contact
  String phoneNumber = '';
  String whatsappNumber = '';
  String email = '';
  String addressLine1 = '';
  String addressLine2 = '';

  // Step 3 -- association
  String? associationPositionId;
  String? industryId;

  // Step 4 -- location
  String? stateId;
  String? districtId;
  String? talukId;
  String? rtoId;

  // The password the applicant chooses. Carried across on approval, so they
  // sign in later with what they typed here.
  String password = '';
  String confirmPassword = '';

  /// Aadhaar with spacing and dashes removed.
  ///
  /// The server does the same (`.transform(v => v.replace(/\D/g, ''))`) and
  /// then requires exactly 12 digits, so validating the stripped form here
  /// matches what it will actually check.
  String get aadhaarDigits => aadhaarNumber.replaceAll(RegExp(r'\D'), '');

  /// Clears the dependent pickers when a parent changes.
  ///
  /// Leaving a stale taluk under a new district would fail `assertChain`
  /// server-side with a confusing message, so the form never offers the
  /// chance.
  void setState(String? id) {
    stateId = id;
    districtId = null;
    talukId = null;
    rtoId = null;
  }

  void setDistrict(String? id) {
    districtId = id;
    talukId = null;
    // The RTO hangs off the district, so it clears with the district too.
    rtoId = null;
  }

  /// The request body for `POST public/member/apply`.
  ///
  /// Optional fields are OMITTED rather than sent empty: the schema types them
  /// `.optional()`, and an empty string fails `.min(1)` on some of them while
  /// silently storing a blank on others.
  ///
  /// There is no `tenantBusinessId` -- the server takes the association from
  /// the hostname, and no body field could override it.
  ///
  /// There is no `passportPhotoPath` either: no public upload route exists, so
  /// staff attach the photo at approval.
  Map<String, Object?> toJson() {
    final body = <String, Object?>{
      'memberName': memberName.trim(),
      'businessName': businessName.trim(),
      'associationPositionId': associationPositionId,
      'industryId': industryId,
      'aadhaarNumber': aadhaarDigits,
      'phoneNumber': phoneNumber.trim(),
      'email': email.trim(),
      'stateId': stateId,
      'districtId': districtId,
      'talukId': talukId,
      'rtoId': rtoId,
      'addressLine1': addressLine1.trim(),
      'dateOfBirth': dateOfBirth,
      // A real JSON boolean, never the string "false". The schema is
      // `z.coerce.boolean()`, under which "false" coerces to TRUE -- so a
      // stringified value here would silently mark every applicant married.
      'isMarried': isMarried,
      'password': password,
    };

    void optional(String key, String value) {
      final trimmed = value.trim();
      if (trimmed.isNotEmpty) body[key] = trimmed;
    }

    optional('memberNameTamil', memberNameTamil);
    optional('businessNameTamil', businessNameTamil);
    optional('whatsappNumber', whatsappNumber);
    optional('addressLine2', addressLine2);
    // Rejected outright by the server unless isMarried is true.
    if (isMarried) optional('weddingDate', weddingDate);

    return body;
  }
}

/// What `POST public/member/apply` returns.
class SubmittedApplication {
  const SubmittedApplication({
    required this.applicationNumber,
    required this.status,
    required this.submittedAt,
  });

  /// Zero-padded digits from `000001`, per association.
  final String applicationNumber;

  /// `PENDING`. An application grants nothing until staff approve it.
  final String status;

  /// UNIX seconds.
  final int submittedAt;

  factory SubmittedApplication.fromJson(Map<String, dynamic> json) =>
      SubmittedApplication(
        applicationNumber: json['applicationNumber'] as String? ?? '',
        status: json['status'] as String? ?? 'PENDING',
        submittedAt: (json['submittedAt'] as num?)?.toInt() ?? 0,
      );
}
