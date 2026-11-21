import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const TenantBusinessSettingListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  /**
   * Required: settings are only meaningful for one business at a time, and a
   * cross-business list would be a wall of repeated keys.
   */
  tenantBusinessId: z.string().uuid(),
  category: z.string().max(50).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DELETED']).optional(),
  sortBy: z
    .enum(['sortOrder', 'settingKey', 'category', 'createdAt'])
    .default('sortOrder'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export class TenantBusinessSettingListQueryDto extends createZodDto(
  TenantBusinessSettingListQuerySchema,
) {}
