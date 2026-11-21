import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const SyncLogListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  tenantBusinessId: z.string().uuid().optional(),
  settingDefinitionId: z.string().uuid().optional(),
  action: z.enum(['INSERTED', 'SKIPPED', 'FAILED']).optional(),
  sortBy: z.enum(['syncedAt']).default('syncedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export class SyncLogListQueryDto extends createZodDto(SyncLogListQuerySchema) {}
