import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const StatusEnum = z.enum(['ACTIVE', 'INACTIVE', 'DELETED']);

// max() mirrors the Prisma VarChar exactly.
const CreateTenantDistrictSchema = z.object({
  tenantBusinessId: z.string().uuid(),
  stateId: z.string().uuid(),
  districtName: z.string().min(1).max(100),
  /** Optional: may be recorded in English only. */
  districtNameTamil: z.string().max(100).optional(),
  districtCode: z.string().min(1).max(10),
});

/**
 * `status` is absent from create and added here with DELETED excluded, so a
 * row can only reach DELETED through the DELETE endpoint - never a PATCH that
 * would bypass the soft-delete bookkeeping.
 */
const UpdateTenantDistrictSchema = CreateTenantDistrictSchema.partial().extend({
  status: StatusEnum.exclude(['DELETED']).optional(),
});

export class CreateTenantDistrictDto extends createZodDto(CreateTenantDistrictSchema) {}
export class UpdateTenantDistrictDto extends createZodDto(UpdateTenantDistrictSchema) {}
