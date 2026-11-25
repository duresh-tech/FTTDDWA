import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

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
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isoDate = (label: string) =>
  z
    .string()
    .regex(DATE_PATTERN, `${label} must be a date in YYYY-MM-DD format`)
    // The regex accepts 2026-02-31; Date.parse does not.
    .refine((v) => !Number.isNaN(Date.parse(v)), `${label} is not a real date`);

/** Twelve digits, however the user spaced them. */
const aadhaar = z
  .string()
  .refine(
    (v) => v.replace(/\D/g, '').length === 12,
    'aadhaarNumber must be 12 digits',
  );

const CreateTenantMemberSchema = z
  .object({
    tenantBusinessId: z.string().uuid(),

    memberName: z.string().min(1).max(100),
    memberNameTamil: z.string().max(100).optional(),
    businessName: z.string().min(1).max(100),
    businessNameTamil: z.string().max(100).optional(),

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

    dateOfBirth: isoDate('dateOfBirth'),
    isMarried: z.coerce.boolean().default(false),
    weddingDate: isoDate('weddingDate').optional(),

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
    weddingDate: isoDate('weddingDate').nullable().optional(),
    /** Blank means "unchanged" - see the service. Never "clear it". */
    aadhaarNumber: aadhaar.or(z.literal('')).optional(),
  });

const ChangeTenantMemberStatusSchema = z.object({
  status: MemberStatusEnum.exclude(['DELETED']),
  /** Why, for the audit trail a suspension deserves. */
  remark: z.string().max(255).optional(),
});

export class CreateTenantMemberDto extends createZodDto(CreateTenantMemberSchema) {}
export class UpdateTenantMemberDto extends createZodDto(UpdateTenantMemberSchema) {}
export class ChangeTenantMemberStatusDto extends createZodDto(
  ChangeTenantMemberStatusSchema,
) {}
