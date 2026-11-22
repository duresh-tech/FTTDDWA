import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const TenantStateListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  /** Matches the English name, the Tamil name, the code or the system code. */
  search: z.string().max(100).optional(),
  // DELETED is included on purpose: that is how the deleted view is requested.
  status: z.enum(['ACTIVE', 'INACTIVE', 'DELETED']).optional(),
  tenantBusinessId: z.string().uuid().optional(),
  // A whitelist, because it is interpolated as `orderBy: { [sortBy]: ... }`.
  sortBy: z.enum(['stateName', 'createdAt', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export class TenantStateListQueryDto extends createZodDto(TenantStateListQuerySchema) {}
