/// One row of a lookup list, flattened to a common shape.
///
/// The API names every list's fields after itself -- `districtName`,
/// `talukNameTamil`, `rtoCode` -- so each list is parsed with its own prefix
/// and ends up here, letting one picker widget serve all six.
class LookupItem {
  const LookupItem({
    required this.id,
    required this.name,
    this.tamil,
    this.code,
    this.parentId,
  });

  final String id;
  final String name;
  final String? tamil;

  /// RTOs only. Part of the label, because the registration series is worth
  /// seeing while choosing.
  final String? code;

  /// The id this row hangs off, for the cascades. Null on a top-level list.
  final String? parentId;

  String get label => code == null ? name : '$code — $name';

  static List<LookupItem> listFrom(
    Object? json, {
    required String prefix,
    String? parentKey,
  }) {
    if (json is! List) return const [];
    final items = <LookupItem>[];
    for (final row in json) {
      if (row is! Map) continue;
      final id = row['id'];
      final name = row['${prefix}Name'];
      if (id is! String || name is! String) continue;
      items.add(
        LookupItem(
          id: id,
          name: name,
          tamil: row['${prefix}NameTamil'] as String?,
          code: row['${prefix}Code'] as String?,
          parentId: parentKey == null ? null : row[parentKey] as String?,
        ),
      );
    }
    return items;
  }
}

/// Everything the registration form's pickers need, from one call.
///
/// All six lists arrive together and cascade in memory. The web form does the
/// same: asking the server again on every change would be a round trip per
/// keystroke-equivalent, and these are small ACTIVE-only reference lists that
/// already print on every card.
class MemberOptions {
  const MemberOptions({
    required this.positions,
    required this.industries,
    required this.states,
    required this.districts,
    required this.taluks,
    required this.rtos,
  });

  final List<LookupItem> positions;
  final List<LookupItem> industries;
  final List<LookupItem> states;
  final List<LookupItem> districts;
  final List<LookupItem> taluks;
  final List<LookupItem> rtos;

  factory MemberOptions.fromJson(Map<String, dynamic> json) => MemberOptions(
    positions: LookupItem.listFrom(json['positions'], prefix: 'position'),
    industries: LookupItem.listFrom(json['industries'], prefix: 'industry'),
    states: LookupItem.listFrom(json['states'], prefix: 'state'),
    districts: LookupItem.listFrom(
      json['districts'],
      prefix: 'district',
      parentKey: 'stateId',
    ),
    taluks: LookupItem.listFrom(
      json['taluks'],
      prefix: 'taluk',
      parentKey: 'districtId',
    ),
    rtos: LookupItem.listFrom(
      json['rtos'],
      prefix: 'rto',
      // NOT `districtId`. Every other list uses the short name; this one
      // does not, and cascading off the wrong key yields a silently empty
      // RTO picker rather than an error.
      parentKey: 'tenantDistrictId',
    ),
  );

  List<LookupItem> districtsOf(String? stateId) =>
      districts.where((d) => d.parentId == stateId).toList();

  List<LookupItem> taluksOf(String? districtId) =>
      taluks.where((t) => t.parentId == districtId).toList();

  /// RTOs hang off the DISTRICT, not the taluk sitting directly above them in
  /// the form. The layout invites the wrong assumption.
  List<LookupItem> rtosOf(String? districtId) =>
      rtos.where((r) => r.parentId == districtId).toList();

  bool get isEmpty =>
      positions.isEmpty &&
      industries.isEmpty &&
      states.isEmpty &&
      districts.isEmpty;
}

/// The association's public details, for the splash and the login screen.
class PublicSite {
  const PublicSite({
    required this.association,
    required this.registrationOpen,
    this.fixedPositionId,
    this.loaded = true,
  });

  /// An allow-listed subset of the Association settings, keyed
  /// `association.name`, `association.logo1Path` and so on. Keys with no value
  /// are omitted by the server, so every read is a null check.
  final Map<String, String> association;

  /// Whether this association accepts applications.
  final bool registrationOpen;

  /// Set when the association files every applicant under one position.
  ///
  /// The server also narrows `options.positions` to it and overrides whatever
  /// is submitted, so this only decides how the field is PRESENTED.
  final String? fixedPositionId;

  /// What the app holds when the association could NOT be reached.
  ///
  /// `loaded` is the whole point. Without it this is indistinguishable from a
  /// business that has closed its register, and the login screen silently
  /// drops the Apply button on a slow network - telling the applicant nothing
  /// and leaving them to conclude the association does not take applications.
  static const empty = PublicSite(
    association: {},
    registrationOpen: false,
    loaded: false,
  );

  /// Whether these details actually came back from the server.
  final bool loaded;

  factory PublicSite.fromJson(Map<String, dynamic> json) {
    final raw = json['association'];
    final map = <String, String>{};
    if (raw is Map) {
      raw.forEach((key, value) {
        if (key is String && value is String && value.isNotEmpty) {
          map[key] = value;
        }
      });
    }
    return PublicSite(
      association: map,
      registrationOpen: json['registrationOpen'] as bool? ?? false,
      fixedPositionId: json['fixedPositionId'] as String?,
    );
  }

  String? get name => association['association.name'];
  String? get nameTamil => association['association.nameTamil'];
  String? get shortName => association['association.shortName'];
  // The server has always sent this; nothing read it until the login
  // masthead had a Tamil mode to render.
  String? get shortNameTamil => association['association.shortNameTamil'];
  String? get tagline => association['association.tagline'];
  String? get taglineTamil => association['association.taglineTamil'];
  String? get logoPath => association['association.logo1Path'];
  String? get email => association['association.email'];
  String? get phoneNumber => association['association.phoneNumber'];

  String? get officeAddress {
    final parts = [
      association['association.officeAddress'],
      association['association.pincode'],
    ].where((p) => p != null && p.isNotEmpty).toList();
    return parts.isEmpty ? null : parts.join(' — ');
  }
}
