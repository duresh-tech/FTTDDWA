import { z } from 'zod';

/**
 * Field rules shared by the member register and the application form.
 *
 * The two DTO files each carried their own copy of `isoDate` and `aadhaar`,
 * which is how an applicant could already be held to a rule a member was not.
 * They live here now so a member and an applicant are judged by the same
 * string, because approval copies one into the other.
 *
 * Nothing in here knows about HTTP or Prisma - it is Zod pieces, importable
 * from any DTO.
 */

/** The wire format: `YYYY-MM-DD`, matching `<input type="date">`. */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Seconds in a day, for the date arithmetic below. */
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A calendar date as a string, in the wire format, that is also a real date.
 *
 * The regex alone accepts `2026-02-31`; `Date.parse` is what rejects it.
 */
export const isoDate = (label: string) =>
  z
    .string()
    .regex(DATE_PATTERN, `${label} must be a date in YYYY-MM-DD format`)
    .refine((value) => !Number.isNaN(Date.parse(value)), `${label} must be a real date`);

/** Midnight UTC today, the boundary every date rule below compares against. */
function startOfToday(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

/**
 * A date that has already happened.
 *
 * Today itself is rejected for a birth date and allowed for a wedding date,
 * so the boundary is a parameter rather than a decision made here.
 */
export const pastDate = (label: string, options: { allowToday?: boolean } = {}) =>
  isoDate(label).refine(
    (value) => {
      const parsed = Date.parse(value);
      return options.allowToday ? parsed <= startOfToday() : parsed < startOfToday();
    },
    `${label} cannot be in the future`,
  );

/**
 * A birth date: in the past, and old enough.
 *
 * The floor exists because the common failure is not a cheeky applicant but a
 * typo - a year typed as 2019 instead of 1979, or today's date tabbed into
 * the wrong field. Members of a trade association are business owners, so a
 * date under the floor is a mistake worth catching at the boundary rather
 * than discovering on a printed ID card.
 *
 * `MINIMUM_AGE_YEARS` is deliberately one number in one place: the console
 * and the Flutter app set their pickers' bounds from the same rule, and three
 * copies of "18" would drift.
 */
export const MINIMUM_AGE_YEARS = 18;

export const birthDate = (label: string) =>
  pastDate(label).refine((value) => {
    const now = new Date();
    // Calendar arithmetic, not 18 * 365 days: subtracting years keeps leap
    // days out of it, so somebody born on 29 February is of age on the same
    // date every year rather than a day early or late.
    const floor = Date.UTC(
      now.getUTCFullYear() - MINIMUM_AGE_YEARS,
      now.getUTCMonth(),
      now.getUTCDate(),
    );
    return Date.parse(value) <= floor;
  }, `${label} must be at least ${MINIMUM_AGE_YEARS} years ago`);

/**
 * Twelve digits, however they were spaced.
 *
 * The transform is what makes `1234 5678 9012` and `1234-5678-9012` the same
 * number - everything downstream (the blind index, the last four) reads bare
 * digits, so normalising here means no caller has to remember to.
 */
export const aadhaar = z
  .string()
  .transform((value) => value.replace(/\D/g, ''))
  .refine((digits) => digits.length === 12, 'Aadhaar number must be 12 digits');

/** Any Latin letter. Digits and punctuation are deliberately not included. */
const LATIN_LETTER = /[A-Za-z]/;

/**
 * A field that holds a Tamil rendering of a name.
 *
 * It refuses **Latin letters**, not "anything that is not Tamil". The mistake
 * this catches is the one people actually make - typing the English name into
 * the Tamil box, so a card prints the same name twice - while a numeral or a
 * `&` in a business name stays legal, because those are written the same way
 * in both scripts.
 *
 * Blank stays legal: these fields are optional, and a business that has never
 * recorded a Tamil name must not be unable to save.
 *
 * Note what this does NOT do: it does not require Tamil characters. A name
 * written in digits alone would pass. Demanding Tamil would reject a legally
 * registered name that happens to be numeric, and the cost of that is worse
 * than the cost of a lax edge case.
 */
export const tamilText = (label: string, max = 100) =>
  z
    .string()
    .max(max)
    .refine(
      (value) => !LATIN_LETTER.test(value),
      `${label} must be written in Tamil, not English letters`,
    );
