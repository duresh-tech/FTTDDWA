import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isoDate = (field: string) =>
  z
    .string()
    .regex(DATE_PATTERN, `${field} must be a date in YYYY-MM-DD format`)
    .refine((value) => !Number.isNaN(Date.parse(value)), `${field} must be a real date`);

/** Twelve digits, however the applicant spaced them. */
const aadhaar = z
  .string()
  .transform((value) => value.replace(/\D/g, ''))
  .refine((digits) => digits.length === 12, 'Aadhaar number must be 12 digits');

/**
 * The public registration form.
 *
 * **`tenantBusinessId` is deliberately absent.** It comes from the hostname,
 * resolved server-side - an anonymous caller must not be able to name the
 * association they are applying to, or anyone could file against any of them.
 *
 * `applicationNumber` is absent for the same reason membership numbers are:
 * it is allocated, not supplied.
 */
export const SubmitMemberApplicationSchema = z
  .object({
    memberName: z.string().min(1).max(100),
    memberNameTamil: z.string().max(100).optional(),
    businessName: z.string().min(1).max(100),
    businessNameTamil: z.string().max(100).optional(),

    associationPositionId: z.string().uuid(),
    industryId: z.string().uuid(),

    aadhaarNumber: aadhaar,

    phoneNumber: z.string().min(5).max(20),
    whatsappNumber: z.string().min(5).max(20).optional(),
    email: z.string().email().max(191),

    stateId: z.string().uuid(),
    districtId: z.string().uuid(),
    talukId: z.string().uuid(),
    rtoId: z.string().uuid(),
    addressLine1: z.string().min(1).max(255),
    addressLine2: z.string().max(255).optional(),

    dateOfBirth: isoDate('dateOfBirth'),
    isMarried: z.coerce.boolean().default(false),
    weddingDate: isoDate('weddingDate').optional(),

    passportPhotoPath: z.string().max(255).optional(),

    /**
     * What they will sign in with once approved. Hashed with Argon2id before
     * it touches the database and never returned.
     */
    password: z.string().min(8).max(128),
  })
  .superRefine((value, ctx) => {
    // Same rule the register enforces: a wedding date only means something
    // when the applicant says they are married.
    if (!value.isMarried && value.weddingDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['weddingDate'],
        message: 'A wedding date cannot be given unless isMarried is true',
      });
    }
  });

const RejectMemberApplicationSchema = z.object({
  /** Shown to staff on the record. Not sent to the applicant by this system. */
  reason: z.string().max(255).optional(),
});

export class SubmitMemberApplicationDto extends createZodDto(
  SubmitMemberApplicationSchema,
) {}
export class RejectMemberApplicationDto extends createZodDto(
  RejectMemberApplicationSchema,
) {}
