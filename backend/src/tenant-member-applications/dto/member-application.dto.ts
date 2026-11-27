import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  aadhaar,
  birthDate,
  pastDate,
  tamilText,
} from '../../common/validation/field-rules';

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
    memberNameTamil: tamilText('memberNameTamil').optional(),
    businessName: z.string().min(1).max(100),
    businessNameTamil: tamilText('businessNameTamil').optional(),

    associationPositionId: z.string().uuid(),
    industryId: z.string().uuid(),

    // Optional - see the member schema. An applicant without one is simply
    // not duplicate-checked, which is the honest consequence of making the
    // blind index's only input optional.
    aadhaarNumber: aadhaar.or(z.literal('')).optional(),

    phoneNumber: z.string().min(5).max(20),
    whatsappNumber: z.string().min(5).max(20).optional(),
    email: z.string().email().max(191),

    stateId: z.string().uuid(),
    districtId: z.string().uuid(),
    talukId: z.string().uuid(),
    rtoId: z.string().uuid(),
    addressLine1: z.string().min(1).max(255),
    addressLine2: z.string().max(255).optional(),

    // The same rules the register holds a member to, from the same module:
    // approval COPIES an application into a member, so a date this accepts
    // and the register would not is a row that can never be approved.
    dateOfBirth: birthDate('dateOfBirth'),
    isMarried: z.coerce.boolean().default(false),
    weddingDate: pastDate('weddingDate', { allowToday: true }).nullable().optional(),

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

    // And married no earlier than born - the register's rule, restated here
    // for the same reason the one above is.
    if (
      value.weddingDate &&
      value.dateOfBirth &&
      Date.parse(value.weddingDate) < Date.parse(value.dateOfBirth)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['weddingDate'],
        message: 'A wedding date cannot be before the date of birth',
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
