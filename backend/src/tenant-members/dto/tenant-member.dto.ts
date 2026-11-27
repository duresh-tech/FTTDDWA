import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  aadhaar,
  birthDate,
  pastDate,
  tamilText,
} from '../../common/validation/field-rules';

/**
 * The states a caller may WRITE.
 *
 * SUSPENDED and EXPIRED were retired: they duplicated INACTIVE without
 * anything acting on the difference - nothing expired a membership on a date,
 * and nothing treated a suspension differently from being inactive.
 *
 * They remain in the Prisma enum on purpose. Postgres cannot drop an enum
 * value in place, and a row written before this change is still a true record
 * of what staff chose; narrowing the WRITE path stops new ones without
 * rewriting history.
 */
const MemberStatusEnum = z.enum(['ACTIVE', 'INACTIVE', 'PENDING', 'DELETED']);

/** Same shape the settings store validates its DATE type with. */
const CreateTenantMemberSchema = z
  .object({
    tenantBusinessId: z.string().uuid(),

    memberName: z.string().min(1).max(100),
    memberNameTamil: tamilText('memberNameTamil').optional(),
    businessName: z.string().min(1).max(100),
    businessNameTamil: tamilText('businessNameTamil').optional(),

    associationPositionId: z.string().uuid(),
    industryId: z.string().uuid(),

    // Optional. Supplying one still means twelve digits, and still gets it
    // encrypted and duplicate-checked; leaving it out simply means there is
    // nothing to check against. An empty string reads as absent, because
    // that is how a cleared form field arrives.
    aadhaarNumber: aadhaar.or(z.literal('')).optional(),

    phoneNumber: z.string().min(5).max(20),
    whatsappNumber: z.string().min(5).max(20).optional(),
    email: z.string().email().max(191),

    stateId: z.string().uuid(),
    districtId: z.string().uuid(),
    talukId: z.string().uuid(),
    /** The RTO, which hangs off the DISTRICT - not the taluk above it here. */
    rtoId: z.string().uuid(),
    addressLine1: z.string().min(1).max(255),
    addressLine2: z.string().max(255).optional(),

    dateOfBirth: birthDate('dateOfBirth'),
    isMarried: z.coerce.boolean().default(false),
    // Nullable, not merely optional: both console forms send an explicit null
    // to CLEAR a stored date when a member is no longer recorded as married,
    // and on create they send the same null rather than branching. Without
    // this, every enrolment of an unmarried member was rejected with
    // "Expected string, received null".
    weddingDate: pastDate('weddingDate', { allowToday: true }).nullable().optional(),

    passportPhotoPath: z.string().max(255).optional(),
    remark: z.string().max(255).optional(),
  })
  .superRefine((data, ctx) => {
    // A wedding date on someone recorded as unmarried is a data-entry
    // mistake, not a preference - refuse it rather than storing a
    // contradiction. (The service also nulls the date when the flag is
    // cleared on update, which this schema alone cannot do.)
    if (!data.isMarried && data.weddingDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'weddingDate cannot be set unless isMarried is true',
        path: ['weddingDate'],
      });
    }

    // Married before being born is the other direction of the same typo the
    // age floor catches - usually a year mistyped in one field or the other.
    // Only checkable here, where both dates are in hand.
    if (
      data.weddingDate &&
      data.dateOfBirth &&
      Date.parse(data.weddingDate) < Date.parse(data.dateOfBirth)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'weddingDate cannot be before dateOfBirth',
        path: ['weddingDate'],
      });
    }
  });

/**
 * `status` is absent from create - a member starts PENDING - and from update,
 * because the lifecycle moves through its own endpoint with its own
 * permission. DELETE is the only way to reach DELETED.
 *
 * The same `isMarried`/`weddingDate` rule applies here, but it has to be
 * re-stated: `.partial()` drops the superRefine, and on a PATCH either field
 * may be absent, so the check falls back to what is already stored. That
 * fallback is the service's job, not the schema's - see updateMarriage().
 */
const UpdateTenantMemberSchema = CreateTenantMemberSchema.innerType()
  .partial()
  .extend({
    /** Explicit null clears it; omitted leaves it alone. */
    weddingDate: pastDate('weddingDate', { allowToday: true }).nullable().optional(),
    /** Blank means "unchanged" - see the service. Never "clear it". */
    aadhaarNumber: aadhaar.or(z.literal('')).optional(),
  });

const ChangeTenantMemberStatusSchema = z.object({
  status: MemberStatusEnum.exclude(['DELETED']),
  /** Why, for the audit trail a suspension deserves. */
  remark: z.string().max(255).optional(),
});

/**
 * A password set FOR a member, by staff.
 *
 * There is deliberately no `currentPassword`: staff do not have it, which
 * is the whole point of the route and the reason it carries its own
 * permission rather than riding on `update`.
 */
const ResetTenantMemberPasswordSchema = z.object({
  // The same rule the public registration form applies, so a password a
  // member could have chosen for themselves is one staff can set for them.
  newPassword: z.string().min(8).max(128),
});

export class CreateTenantMemberDto extends createZodDto(CreateTenantMemberSchema) {}
export class UpdateTenantMemberDto extends createZodDto(UpdateTenantMemberSchema) {}
export class ResetTenantMemberPasswordDto extends createZodDto(
  ResetTenantMemberPasswordSchema,
) {}
export class ChangeTenantMemberStatusDto extends createZodDto(
  ChangeTenantMemberStatusSchema,
) {}
