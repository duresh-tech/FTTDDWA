/// Field rules the application form checks before it sends anything.
///
/// Every rule here is also enforced by the server, in
/// `backend/src/common/validation/field-rules.ts`. These exist so a mistake is
/// named under the field that caused it rather than arriving as a 400 three
/// screens later, and so the date pickers can be bounded. The server remains
/// the only thing that actually decides.
///
/// **They return a CODE, not a sentence.** This file is pure Dart with no
/// `BuildContext`, so it cannot reach the translations - and a rule that
/// returned English prose could only ever be shown in English. The screens
/// turn a code into words through [describeDateProblem] and [describeTamil].
/// The tests assert on codes, which is also sturdier than matching prose.
library;

import '../l10n/app_localizations.dart';

/// Must match `MINIMUM_AGE_YEARS` in the backend's field-rules.ts.
const int minimumAgeYears = 18;

/// What is wrong with a date, if anything.
enum DateProblem {
  /// Nothing chosen, and this field needs one.
  missing,

  /// Not a date at all - a value that could only arrive by being typed.
  unreal,

  /// A birth date that would make the applicant younger than the floor.
  tooYoung,

  /// A wedding date later than today.
  inFuture,

  /// A wedding date earlier than the date of birth.
  beforeBirth,
}

/// `YYYY-MM-DD`, which is what the form and the wire both use.
String _isoDay(DateTime date) {
  final month = '${date.month}'.padLeft(2, '0');
  final day = '${date.day}'.padLeft(2, '0');
  return '${date.year}-$month-$day';
}

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

/// Whether a Tamil-only field holds English letters.
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
/// Checked on SUBMIT and never per keystroke. Tamil is commonly typed on a
/// transliteration keyboard, where Latin letters are the intermediate state
/// before the Tamil is committed - filtering input would break exactly the
/// people the field exists for.
bool tamilOnly(String? value) {
  final text = (value ?? '').trim();
  if (text.isEmpty) return true;
  return !_latinLetter.hasMatch(text);
}

/// A date of birth: present, real, and old enough.
///
/// The age floor is not about turning teenagers away. It catches a typo - a
/// year entered as 2019 instead of 1979 - which otherwise reaches a printed
/// membership card.
DateProblem? dateOfBirthError(String value) {
  if (value.isEmpty) return DateProblem.missing;
  final parsed = DateTime.tryParse(value);
  if (parsed == null) return DateProblem.unreal;
  if (parsed.isAfter(latestBirthDate())) return DateProblem.tooYoung;
  return null;
}

/// A wedding date, checked against the birth date it has to follow.
///
/// Blank is refused only when the applicant says they are married, which is
/// the one case where the date means something.
DateProblem? weddingDateError(String value, String dateOfBirth) {
  if (value.isEmpty) return DateProblem.missing;
  final parsed = DateTime.tryParse(value);
  if (parsed == null) return DateProblem.unreal;
  final now = DateTime.now();
  if (parsed.isAfter(DateTime(now.year, now.month, now.day))) {
    return DateProblem.inFuture;
  }
  final born = DateTime.tryParse(dateOfBirth);
  if (born != null && parsed.isBefore(born)) return DateProblem.beforeBirth;
  return null;
}

/// Today, for a date picker's upper bound.
String todayIso() => _isoDay(DateTime.now());

/// Puts a [DateProblem] into the reader's language.
///
/// `missing` and `unreal` read differently for the two dates, so the caller
/// says which field it is asking about.
String describeDateProblem(L l, DateProblem problem, {bool wedding = false}) {
  switch (problem) {
    case DateProblem.missing:
      return wedding
          ? l.validationChooseWeddingDate
          : l.validationChooseDateOfBirth;
    case DateProblem.unreal:
      return wedding
          ? l.validationWeddingDateUnreal
          : l.validationDateOfBirthUnreal;
    case DateProblem.tooYoung:
      return l.validationTooYoung(minimumAgeYears);
    case DateProblem.inFuture:
      return l.validationWeddingInFuture;
    case DateProblem.beforeBirth:
      return l.validationWeddingBeforeBirth;
  }
}

/// The message for a Tamil-only field, or null when it is fine.
String? describeTamil(L l, bool ok, String fieldName) =>
    ok ? null : l.validationTamilOnly(fieldName);
