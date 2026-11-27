import 'package:flutter_test/flutter_test.dart';
import 'package:member_app/shared/validation.dart';

/// The rules the server also enforces. They are duplicated on purpose, so a
/// mistake is named under the field rather than arriving as a 400 - which
/// means they have to agree with the server, and these tests are what says so.
void main() {
  group('tamilOnly', () {
    test('accepts blank, because the field is optional', () {
      expect(tamilOnly('', 'Your Tamil name'), isNull);
      expect(tamilOnly(null, 'Your Tamil name'), isNull);
    });

    test('rejects the English name typed into the Tamil box', () {
      // The actual mistake this exists for: a card that prints one name twice.
      expect(tamilOnly('Ramesh', 'Your Tamil name'), isNotNull);
    });

    test('accepts Tamil', () {
      expect(tamilOnly('ராமேஷ்', 'Your Tamil name'), isNull);
    });

    test('accepts Tamil carrying a numeral', () {
      // A business name may legitimately contain a digit, and a digit is
      // written the same way in both scripts.
      expect(tamilOnly('ராமேஷ் 2', 'The Tamil business name'), isNull);
    });
  });

  group('dateOfBirthError', () {
    test('requires one', () {
      expect(dateOfBirthError(''), isNotNull);
    });

    test('rejects a date under the age floor', () {
      final recent = DateTime.now().subtract(const Duration(days: 365 * 5));
      final iso = recent.toIso8601String().split('T').first;
      expect(dateOfBirthError(iso), contains('$minimumAgeYears'));
    });

    test('accepts an adult', () {
      expect(dateOfBirthError('1979-03-04'), isNull);
    });
  });

  group('weddingDateError', () {
    test('requires one once married is ticked', () {
      expect(weddingDateError('', '1979-03-04'), isNotNull);
    });

    test('rejects a wedding before the birth', () {
      // The other direction of the same mistyped-year typo the floor catches.
      expect(weddingDateError('1970-01-01', '1979-03-04'), isNotNull);
    });

    test('rejects a wedding in the future', () {
      final future = DateTime.now().add(const Duration(days: 30));
      final iso = future.toIso8601String().split('T').first;
      expect(weddingDateError(iso, '1979-03-04'), isNotNull);
    });

    test('accepts a wedding after the birth', () {
      expect(weddingDateError('2005-06-01', '1979-03-04'), isNull);
    });
  });
}
