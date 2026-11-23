import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const StatusEnum = z.enum(['ACTIVE', 'INACTIVE', 'DELETED']);

// max() mirrors the Prisma VarChar exactly.
const CreateTenantRtoSchema = z.object({
  tenantBusinessId: z.string().uuid(),
  /** The district the office serves. Validated against the business too. */
  tenantDistrictId: z.string().uuid(),
  rtoName: z.string().min(1).max(100),
  /** Optional: may be recorded in English only. */
  rtoNameTamil: z.string().max(100).optional(),
  rtoCode: z.string().min(1).max(10),
});

/**
 * `status` is absent from create and added here with DELETED excluded, so a
 * row can only reach DELETED through the DELETE endpoint - never a PATCH that
 * would bypass the soft-delete bookkeeping.
 */
const UpdateTenantRtoSchema = CreateTenantRtoSchema.partial().extend({
  status: StatusEnum.exclude(['DELETED']).optional(),
});

export class CreateTenantRtoDto extends createZodDto(CreateTenantRtoSchema) {}
export class UpdateTenantRtoDto extends createZodDto(UpdateTenantRtoSchema) {}
