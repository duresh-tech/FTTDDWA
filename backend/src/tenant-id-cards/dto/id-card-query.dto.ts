import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const IdCardListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  // DELETED is included on purpose: that is how the deleted view is requested.
  status: z.enum(['ACTIVE', 'DELETED']).optional(),
  tenantBusinessId: z.string().uuid().optional(),
  tenantMemberId: z.string().uuid().optional(),
  // A whitelist, because it is interpolated as `orderBy: { [sortBy]: ... }`.
  sortBy: z.enum(['generatedAt', 'createdAt']).default('generatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export class IdCardListQueryDto extends createZodDto(IdCardListQuerySchema) {}
