import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const StatusEnum = z.enum(['ACTIVE', 'INACTIVE', 'DELETED']);

// max() mirrors the Prisma VarChar exactly.
const CreateTenantStateSchema = z.object({
  tenantBusinessId: z.string().uuid(),
  stateName: z.string().min(1).max(100),
  /** Optional: may be recorded in English only. */
  stateNameTamil: z.string().max(100).optional(),
  stateCode: z.string().min(1).max(10),
  country: z.string().min(1).max(100),
});

/**
 * `status` is absent from create and added here with DELETED excluded, so a
 * row can only reach DELETED through the DELETE endpoint - never a PATCH that
 * would bypass the soft-delete bookkeeping.
 */
const UpdateTenantStateSchema = CreateTenantStateSchema.partial().extend({
  status: StatusEnum.exclude(['DELETED']).optional(),
});

export class CreateTenantStateDto extends createZodDto(CreateTenantStateSchema) {}
export class UpdateTenantStateDto extends createZodDto(UpdateTenantStateSchema) {}
