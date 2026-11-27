import 'package:flutter_test/flutter_test.dart';
import 'package:member_app/features/registration/data/application_draft.dart';

/// The request body is where this app can go wrong silently, so it is where
/// the tests are.
void main() {
  ApplicationDraft filled() => ApplicationDraft()
    ..memberName = 'Ramesh Kumar'
    ..businessName = 'Kumar Tents'
    ..associationPositionId = 'pos-1'
    ..industryId = 'ind-1'
    ..aadhaarNumber = '1234 5678 9012'
    ..phoneNumber = '9000000000'
    ..email = 'ramesh@example.com'
    ..stateId = 'st-1'
    ..districtId = 'di-1'
    ..talukId = 'ta-1'
    ..rtoId = 'rto-1'
    ..addressLine1 = '12 Main Street'
    ..dateOfBirth = '1980-04-01'
    ..password = 'correct horse battery';

  group('isMarried', () {
    test('is a real boolean, never the string "false"', () {
      final body = filled().toJson();

      // The server schema is z.coerce.boolean(), under which the STRING
      // "false" coerces to true. Sending a stringified value here would mark
      // every single applicant married.
      expect(body['isMarried'], isA<bool>());
      expect(body['isMarried'], isFalse);
      expect(body['isMarried'], isNot('false'));
    });

    test('a wedding date is omitted unless married', () {
      final draft = filled()
        ..isMarried = false
        ..weddingDate = '2010-06-01';

      // The server rejects a wedding date outright when isMarried is false.
      expect(filledKeys(draft), isNot(contains('weddingDate')));

      draft
        ..isMarried = true
        ..weddingDate = '2010-06-01';
      expect(draft.toJson()['weddingDate'], '2010-06-01');
    });
  });

  group('aadhaar', () {
    test('is sent as 12 bare digits, spacing stripped', () {
      expect(filled().toJson()['aadhaarNumber'], '123456789012');
    });

    test('is OMITTED when blank, not sent as an empty string', () {
      // The server types it `aadhaar.or(z.literal('')).optional()`, so an
      // empty string survives today - but only by that literal's grace.
      // Omitting it is what "optional" actually means, and it keeps the app
      // working if that branch is ever tightened.
      final draft = filled()..aadhaarNumber = '';
      expect(draft.toJson().keys, isNot(contains('aadhaarNumber')));
    });

    test('strips dashes too', () {
      final draft = filled()..aadhaarNumber = '1234-5678-9012';
      expect(draft.aadhaarDigits, '123456789012');
    });
  });

  group('optional fields', () {
    test('are omitted rather than sent empty', () {
      final body = filled().toJson();
      for (final key in [
        'memberNameTamil',
        'businessNameTamil',
        'whatsappNumber',
        'addressLine2',
      ]) {
        expect(body.containsKey(key), isFalse, reason: '$key should be absent');
      }
    });

    test('are included once filled, and trimmed', () {
      final draft = filled()..memberNameTamil = '  ரமேஷ் குமார்  ';
      expect(draft.toJson()['memberNameTamil'], 'ரமேஷ் குமார்');
    });
  });

  test('no business id is ever sent', () {
    // The association comes from the hostname. A body field could not override
    // it, and offering one would invite exactly that attempt.
    expect(filled().toJson().keys, isNot(contains('tenantBusinessId')));
  });

  group('the passport photo', () {
    test('is omitted when the applicant did not add one', () {
      expect(filled().toJson().keys, isNot(contains('passportPhotoPath')));
    });

    test('is sent when they did', () {
      // The value is a storage PATH the photo endpoint returned, never the
      // image itself - the upload is its own request.
      final draft = filled()
        ..passportPhotoPath =
            'member-photos/019f357c-d489-74a9-8490-1f82e745b199.jpg';
      expect(
        draft.toJson()['passportPhotoPath'],
        'member-photos/019f357c-d489-74a9-8490-1f82e745b199.jpg',
      );
    });
  });

  group('isEmpty, which decides whether leaving asks first', () {
    test('a fresh draft is empty', () {
      expect(ApplicationDraft().isEmpty, isTrue);
    });

    test('one typed character is not empty', () {
      expect((ApplicationDraft()..memberName = 'A').isEmpty, isFalse);
    });

    test('whitespace alone is still empty', () {
      expect((ApplicationDraft()..memberName = '   ').isEmpty, isTrue);
    });

    test('a pre-filled position does NOT count as input', () {
      // The screen sets this itself when the association fixes a position, so
      // counting it would put a discard prompt in front of a mis-tap on a
      // form nobody has touched.
      final draft = ApplicationDraft()..associationPositionId = 'pos-1';
      expect(draft.isEmpty, isTrue);
    });

    test('a chosen trade does count - the applicant chose it', () {
      expect((ApplicationDraft()..industryId = 'ind-1').isEmpty, isFalse);
    });

    test('an attached photo counts, since it is already uploaded', () {
      final draft = ApplicationDraft()
        ..passportPhotoPath = 'member-photos/a.jpg';
      expect(draft.isEmpty, isFalse);
    });
  });

  group('cascades clear their children', () {
    test('changing the state clears district, taluk and RTO', () {
      final draft = filled()..setState('st-2');
      expect(draft.districtId, isNull);
      expect(draft.talukId, isNull);
      expect(draft.rtoId, isNull);
    });

    test('changing the district clears taluk AND RTO', () {
      // The RTO hangs off the district, not the taluk, so it must clear here.
      final draft = filled()..setDistrict('di-2');
      expect(draft.talukId, isNull);
      expect(draft.rtoId, isNull);
    });
  });
}

Set<String> filledKeys(ApplicationDraft draft) => draft.toJson().keys.toSet();
