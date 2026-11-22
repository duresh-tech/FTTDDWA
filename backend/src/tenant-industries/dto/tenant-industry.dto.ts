import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const StatusEnum = z.enum(['ACTIVE', 'INACTIVE', 'DELETED']);

// max() mirrors the Prisma VarChar exactly.
const CreateTenantIndustrySchema = z.object({
  tenantBusinessId: z.string().uuid(),
  industryName: z.string().min(1).max(100),
  /** Optional: may be recorded in English only. */
  industryNameTamil: z.string().max(100).optional(),
});

/**
 * `status` is absent from create and added here with DELETED excluded, so a
 * row can only reach DELETED through the DELETE endpoint - never a PATCH that
 * would bypass the soft-delete bookkeeping.
 */
const UpdateTenantIndustrySchema = CreateTenantIndustrySchema.partial().extend({
  status: StatusEnum.exclude(['DELETED']).optional(),
});

export class CreateTenantIndustryDto extends createZodDto(CreateTenantIndustrySchema) {}
export class UpdateTenantIndustryDto extends createZodDto(UpdateTenantIndustrySchema) {}
