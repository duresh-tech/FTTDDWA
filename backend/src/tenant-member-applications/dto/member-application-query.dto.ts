import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const MemberApplicationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  /** Matches both names, the business names, phone, email, and the numbers. */
  search: z.string().max(100).optional(),
  // DELETED is included on purpose: that is how the deleted view is requested.
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'DELETED']).optional(),
  tenantBusinessId: z.string().uuid().optional(),
  // A whitelist, because it is interpolated as `orderBy: { [sortBy]: ... }`.
  sortBy: z.enum(['createdAt', 'applicationNumber', 'memberName', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export class MemberApplicationListQueryDto extends createZodDto(
  MemberApplicationListQuerySchema,
) {}
