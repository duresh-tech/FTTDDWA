import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const StatusEnum = z.enum(['ACTIVE', 'INACTIVE', 'DELETED']);

// max() mirrors the Prisma VarChar exactly.
const CreateTenantTalukSchema = z.object({
  tenantBusinessId: z.string().uuid(),
  stateId: z.string().uuid(),
  districtId: z.string().uuid(),
  talukName: z.string().min(1).max(100),
  /** Optional: may be recorded in English only. */
  talukNameTamil: z.string().max(100).optional(),
});

/**
 * `status` is absent from create and added here with DELETED excluded, so a
 * row can only reach DELETED through the DELETE endpoint - never a PATCH that
 * would bypass the soft-delete bookkeeping.
 */
const UpdateTenantTalukSchema = CreateTenantTalukSchema.partial().extend({
  status: StatusEnum.exclude(['DELETED']).optional(),
});

export class CreateTenantTalukDto extends createZodDto(CreateTenantTalukSchema) {}
export class UpdateTenantTalukDto extends createZodDto(UpdateTenantTalukSchema) {}
