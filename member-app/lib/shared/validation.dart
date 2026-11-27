/// Field rules the application form checks before it sends anything.
///
/// Every rule here is also enforced by the server, in
/// `backend/src/common/validation/field-rules.ts`. These exist so a mistake is
/// named under the field that caused it rather than arriving as a 400 three
/// screens later, and so the date pickers can be bounded. The server remains
/// the only thing that actually decides.
library;

/// Must match `MINIMUM_AGE_YEARS` in the backend's field-rules.ts.
const int minimumAgeYears = 18;

/// The latest date of birth that clears the age floor.
///
/// Subtracting years rather than days keeps leap years out of it: somebody
/// born on 29 February comes of age on the same date every year.
DateTime latestBirthDate() {
  final now = DateTime.now();
  return DateTime(now.year - minimumAgeYears, now.month, now.day);
}

/// Any Latin letter. Digits and punctuation are deliberately not included.
final _latinLetter = RegExp('[A-Za-z]');

/// A field that holds the Tamil rendering of a name.
///
/// It refuses **Latin letters**, not "anything that is not Tamil". The mistake
/// worth catching is the common one - typing the English name into the Tamil
/// box, so a membership card prints the same name twice - while a numeral or
/// an `&` in a business name stays legal, because those are written the same
/// way in both scripts.
///
/// Blank is legal: these fields are optional, and somebody who does not use a
/// Tamil spelling must still be able to apply.
///
/// This validates on SUBMIT and never blocks a keystroke. Tamil is commonly
/// typed on a transliteration keyboard, where Latin letters are the
/// intermediate state before the Tamil is committed - filtering input would
/// break exactly the people the field is for.
String? tamilOnly(String? value, String label) {
  final text = (value ?? '').trim();
  if (text.isEmpty) return null;
  if (_latinLetter.hasMatch(text)) {
    return '$label must be in Tamil, not English letters';
  }
  return null;
}

/// A date of birth, as the `YYYY-MM-DD` the form carries.
///
/// The age floor is not about turning teenagers away. It catches a typo - a
/// year entered as 2019 instead of 1979 - which otherwise reaches a printed
/// membership card.
String? dateOfBirthError(String value) {
  if (value.isEmpty) return 'Choose a date of birth';
  final parsed = DateTime.tryParse(value);
  if (parsed == null) return 'That date of birth is not a real date';
  if (parsed.isAfter(latestBirthDate())) {
    return 'You must be at least $minimumAgeYears years old to apply';
  }
  return null;
}

/// A wedding date, checked against the birth date it has to follow.
///
/// Blank is refused only when the applicant says they are married, which is
/// the one case where the date means something.
String? weddingDateError(String value, String dateOfBirth) {
  if (value.isEmpty) return 'Choose a wedding date';
  final parsed = DateTime.tryParse(value);
  if (parsed == null) return 'That wedding date is not a real date';
  final now = DateTime.now();
  if (parsed.isAfter(DateTime(now.year, now.month, now.day))) {
    return 'A wedding date cannot be in the future';
  }
  final born = DateTime.tryParse(dateOfBirth);
  if (born != null && parsed.isBefore(born)) {
    return 'A wedding date cannot be before your date of birth';
  }
  return null;
}
