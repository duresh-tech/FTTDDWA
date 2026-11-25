import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const TenantMemberListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  /**
   * Matches the member and business names in either script, the phone, the
   * email or the system code. NOT the Aadhaar number - that is encrypted, and
   * a blind index answers equality only, never `contains`.
   */
  search: z.string().max(100).optional(),
  // Matches the write enum - see tenant-member.dto.ts. A legacy SUSPENDED or
  // EXPIRED row still LISTS, it just has no filter chip of its own.
  status: z.enum(['ACTIVE', 'INACTIVE', 'PENDING', 'DELETED']).optional(),
  tenantBusinessId: z.string().uuid().optional(),
  associationPositionId: z.string().uuid().optional(),
  industryId: z.string().uuid().optional(),
  stateId: z.string().uuid().optional(),
  districtId: z.string().uuid().optional(),
  talukId: z.string().uuid().optional(),
  // A whitelist, because it is interpolated as `orderBy: { [sortBy]: ... }`.
  sortBy: z.enum(['memberName', 'createdAt', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export class TenantMemberListQueryDto extends createZodDto(
  TenantMemberListQuerySchema,
) {}
