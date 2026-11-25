import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const TenantStateListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  // 200, not 100: the member form loads every ACTIVE row of each lookup in
  // one request to fill its pickers, and a cap of 100 rejected that with a
  // 400 the form showed as six silently empty dropdowns. The same bump was
  // already applied to tenant-business-settings and site; these six were
  // missed.
  limit: z.coerce.number().int().min(1).max(200).default(20),
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
