/**
 * Field rules the member forms check before they send anything.
 *
 * Every rule here is also enforced by the server, in
 * `backend/src/common/validation/field-rules.ts`. These exist so a mistake is
 * named next to the field that caused it rather than arriving as a 400 after
 * a round trip, and so the date inputs can carry sensible `max` bounds. The
 * server remains the only thing that actually decides.
 *
 * They return a message or `null`, matching how these screens already report
 * trouble: an early `toast.error(...)` and `return` in `onSubmit`. There are
 * no inline field errors anywhere in the console, and this is not the place
 * to introduce the first.
 */

/** Must match MINIMUM_AGE_YEARS in the backend's field-rules.ts. */
export const MINIMUM_AGE_YEARS = 18;

/** `YYYY-MM-DD`, which is what `<input type="date">` reads and writes. */
function isoDay(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Today, for a `max` that stops a date picker offering the future at all. */
export function todayIso(): string {
  return isoDay(new Date());
}

/**
 * The latest date of birth that clears the age floor.
 *
 * Subtracting years rather than days keeps leap years out of it: somebody born
 * on 29 February comes of age on the same date every year.
 */
export function latestBirthDateIso(): string {
  const now = new Date();
  return isoDay(
    new Date(now.getFullYear() - MINIMUM_AGE_YEARS, now.getMonth(), now.getDate()),
  );
}

/**
 * A date of birth: present, real, in the past, and old enough.
 *
 * The age floor is not about turning teenagers away. The failure it catches is
 * a typo - a year entered as 2019 instead of 1979, or today's date tabbed into
 * the wrong box - which otherwise reaches a printed membership card.
 */
export function dateOfBirthError(value: string): string | null {
  if (!value) return "Enter a date of birth";
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return "That date of birth is not a real date";
  if (value > todayIso()) return "A date of birth cannot be in the future";
  if (value > latestBirthDateIso()) {
    return `A member must be at least ${MINIMUM_AGE_YEARS} years old`;
  }
  return null;
}

/**
 * A wedding date, checked against the birth date it has to follow.
 *
 * Blank is fine - the field is optional even for a married member. Today is
 * fine: somebody may be enrolled on their wedding day.
 */
export function weddingDateError(value: string, dateOfBirth: string): string | null {
  if (!value) return null;
  if (Number.isNaN(Date.parse(value))) return "That wedding date is not a real date";
  if (value > todayIso()) return "A wedding date cannot be in the future";
  if (dateOfBirth && value < dateOfBirth) {
    return "A wedding date cannot be before the date of birth";
  }
  return null;
}

/** Any Latin letter. Digits and punctuation are deliberately not included. */
const LATIN_LETTER = /[A-Za-z]/;

/**
 * A field that holds the Tamil rendering of a name.
 *
 * It refuses **Latin letters**, not "anything that is not Tamil". The mistake
 * worth catching is the common one - typing the English name into the Tamil
 * box, so a card prints the same name twice - while a numeral or an `&` in a
 * business name stays legal, because those are written the same way in both
 * scripts.
 *
 * Blank is legal: these fields are optional, and a business that has never
 * recorded a Tamil name must still be saveable.
 *
 * Note this validates on SUBMIT and never blocks a keystroke. Tamil is
 * commonly typed on a transliteration keyboard, where Latin letters are the
 * intermediate state before the Tamil is committed - filtering input would
 * break exactly the people this field is for.
 */
export function tamilTextError(value: string, label: string): string | null {
  if (!value) return null;
  if (LATIN_LETTER.test(value)) {
    return `${label} must be written in Tamil, not English letters`;
  }
  return null;
}

/**
 * An Aadhaar number, which is optional but must be complete when given.
 *
 * The server normalises spacing itself, so anything the user typed is
 * acceptable as long as twelve digits are in there.
 */
export function aadhaarError(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length !== 12) {
    return `An Aadhaar number has 12 digits (you entered ${digits.length})`;
  }
  return null;
}

/**
 * Every member-form rule in one call, in the order the fields appear.
 *
 * Returns the FIRST problem, because the forms report one toast at a time -
 * walking somebody through five errors one submit at a time would be worse,
 * but so would five stacked toasts.
 */
export function memberFormError(form: {
  memberNameTamil: string;
  businessNameTamil: string;
  dateOfBirth: string;
  isMarried: boolean;
  weddingDate: string;
  aadhaarNumber: string;
}): string | null {
  return (
    tamilTextError(form.memberNameTamil, "The member's Tamil name") ??
    tamilTextError(form.businessNameTamil, "The business's Tamil name") ??
    dateOfBirthError(form.dateOfBirth) ??
    (form.isMarried ? weddingDateError(form.weddingDate, form.dateOfBirth) : null) ??
    aadhaarError(form.aadhaarNumber)
  );
}
