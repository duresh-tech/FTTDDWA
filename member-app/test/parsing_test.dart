import 'package:flutter_test/flutter_test.dart';
import 'package:member_app/core/api/api_exception.dart';
import 'package:member_app/features/auth/data/member.dart';
import 'package:member_app/features/profile/data/id_card.dart';
import 'package:member_app/features/registration/data/options.dart';

void main() {
  group('MemberOptions', () {
    final options = MemberOptions.fromJson({
      'positions': [
        {
          'id': 'p1',
          'positionName': 'President',
          'positionNameTamil': 'தலைவர்',
        },
      ],
      'industries': [
        {'id': 'i1', 'industryName': 'Tents', 'industryNameTamil': null},
      ],
      'states': [
        {'id': 's1', 'stateName': 'Tamil Nadu'},
        {'id': 's2', 'stateName': 'Kerala'},
      ],
      'districts': [
        {'id': 'd1', 'districtName': 'Coimbatore', 'stateId': 's1'},
        {'id': 'd2', 'districtName': 'Ernakulam', 'stateId': 's2'},
      ],
      'taluks': [
        {'id': 't1', 'talukName': 'Palladam', 'districtId': 'd1'},
        {'id': 't2', 'talukName': 'Kochi', 'districtId': 'd2'},
      ],
      'rtos': [
        // The parent key here is tenantDistrictId, NOT districtId -- the one
        // list in this payload that does not use the short name.
        {
          'id': 'r1',
          'rtoName': 'Palladam',
          'rtoCode': 'TN72',
          'tenantDistrictId': 'd1',
        },
        {
          'id': 'r2',
          'rtoName': 'Kochi',
          'rtoCode': 'KL07',
          'tenantDistrictId': 'd2',
        },
      ],
    });

    test('districts cascade off the state', () {
      expect(options.districtsOf('s1').map((d) => d.id), ['d1']);
    });

    test('taluks cascade off the district', () {
      expect(options.taluksOf('d1').map((t) => t.id), ['t1']);
    });

    test('RTOs cascade off tenantDistrictId, not districtId', () {
      // Reading the wrong key gives an empty picker and no error at all, which
      // is why this is worth asserting rather than eyeballing.
      expect(options.rtosOf('d1').map((r) => r.id), ['r1']);
      expect(options.rtosOf('d2').map((r) => r.id), ['r2']);
    });

    test('an RTO is labelled with its code', () {
      expect(options.rtosOf('d1').single.label, 'TN72 — Palladam');
    });

    test('a list with no code is labelled by name alone', () {
      expect(options.states.first.label, 'Tamil Nadu');
    });

    test('a missing Tamil name stays null rather than becoming empty', () {
      expect(options.industries.single.tamil, isNull);
      expect(options.positions.single.tamil, 'தலைவர்');
    });
  });

  group('PublicSite', () {
    test('reads the allow-listed association keys', () {
      final site = PublicSite.fromJson({
        'association': {
          'association.name': 'Federation',
          'association.shortName': 'FTTDDWA',
          'association.officeAddress': '1 Street',
          'association.pincode': '641001',
        },
        'registrationOpen': true,
      });

      expect(site.name, 'Federation');
      expect(site.shortName, 'FTTDDWA');
      expect(site.officeAddress, '1 Street — 641001');
      expect(site.registrationOpen, isTrue);
      expect(site.nameTamil, isNull);
    });

    test('registrationOpen false closes the Apply button', () {
      final site = PublicSite.fromJson({
        'association': {},
        'registrationOpen': false,
      });
      expect(site.registrationOpen, isFalse);
    });
  });

  group('Member', () {
    final member = Member.fromJson({
      'id': 'm1',
      'systemCode': 'MEM-1',
      'memberIdNumber': 'TN72001',
      'memberName': 'Ramesh',
      'memberNameTamil': 'ரமேஷ்',
      'businessName': 'Kumar Tents',
      'phoneNumber': '9000000000',
      'email': 'r@example.com',
      'addressLine1': '12 Main Street',
      'dateOfBirth': '1980-04-01',
      'isMarried': false,
      'status': 'ACTIVE',
      'createdAt': 1764000000,
      'aadhaarLast4': '9012',
      // The key is associationPosition, not position.
      'associationPosition': {
        'positionName': 'President',
        'positionNameTamil': 'தலைவர்',
      },
      'rto': {'rtoName': 'Palladam', 'rtoCode': 'TN72', 'rtoNameTamil': null},
    });

    test('reads associationPosition, not position', () {
      expect(member.associationPosition?.name, 'President');
      expect(member.associationPosition?.tamil, 'தலைவர்');
    });

    test('the RTO carries its code into the label', () {
      expect(member.rto?.labelled, 'TN72 — Palladam');
    });

    test('only the last four Aadhaar digits exist client-side', () {
      expect(member.aadhaarLast4, '9012');
      expect(member.maskedAadhaar, '•••• •••• 9012');
    });

    test('dateOfBirth is a string, createdAt is an epoch', () {
      expect(member.dateOfBirth, '1980-04-01');
      expect(member.createdAt, 1764000000);
    });

    test('absent relations are null rather than empty objects', () {
      expect(member.industry, isNull);
      expect(member.taluk, isNull);
    });
  });

  group('IdCard', () {
    test('expired is read from the server, not recomputed', () {
      final card = IdCard.fromJson({
        'id': 'c1',
        'systemCode': 'CARD-1',
        'issueNumber': 2,
        'issuedAt': 1764000000,
        'expiryAt': 1795536000,
        'status': 'ACTIVE',
        'expired': false,
        'fileSizeBytes': 2048,
      });

      // The server computes it from expiryAt and the clock; there is no
      // EXPIRED status to read. Trusting its value keeps the app and the PDF
      // from disagreeing.
      expect(card.expired, isFalse);
      expect(card.status, 'ACTIVE');
      expect(card.issueNumber, 2);
      expect(card.expiresOn, isNotNull);
    });

    test('a null expiry means never expires', () {
      final card = IdCard.fromJson({
        'id': 'c1',
        'issueNumber': 1,
        'issuedAt': 1764000000,
        'expiryAt': null,
        'status': 'ACTIVE',
        'expired': false,
        'fileSizeBytes': 1,
      });
      expect(card.expiryAt, isNull);
      expect(card.expiresOn, isNull);
    });
  });

  group('ApiException', () {
    test('flattens Zod issues with their field path', () {
      final error = ApiException.fromBody(400, {
        'statusCode': 400,
        'message': 'Validation failed',
        'errors': [
          {
            'path': ['email'],
            'message': 'Invalid email',
          },
          {
            'path': ['password'],
            'message': 'Too short',
          },
        ],
      });

      // "Validation failed" alone tells the member nothing actionable.
      expect(error.message, 'email: Invalid email\npassword: Too short');
      expect(error.statusCode, 400);
    });

    test('prefers a plain message when there are no issues', () {
      final error = ApiException.fromBody(401, {
        'message': 'Invalid membership number or password',
      });
      expect(error.message, 'Invalid membership number or password');
    });

    test('reads the first of an array message', () {
      final error = ApiException.fromBody(400, {
        'message': ['Bad', 'Worse'],
      });
      expect(error.message, 'Bad');
    });

    test('falls back to the status code on an unusable body', () {
      expect(ApiException.fromBody(503, null).message, 'Request failed (503)');
    });

    test('404 reads as a misconfigured association host', () {
      expect(
        ApiException.fromBody(404, {
          'message': 'This address does not serve a member portal',
        }).isNoPortal,
        isTrue,
      );
    });
  });
}
