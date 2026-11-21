import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const SettingDefinitionListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  search: z.string().max(100).optional(),
  category: z.string().max(50).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  sortBy: z
    .enum(['sortOrder', 'settingKey', 'category', 'createdAt'])
    .default('sortOrder'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export class SettingDefinitionListQueryDto extends createZodDto(
  SettingDefinitionListQuerySchema,
) {}
