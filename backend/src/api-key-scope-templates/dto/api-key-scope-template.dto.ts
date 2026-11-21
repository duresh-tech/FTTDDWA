import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const StatusEnum = z.enum(['ACTIVE', 'INACTIVE']);
const ScopeSchema = z.string().regex(/^[a-z0-9-]+:[a-z0-9_-]+$/, 'Not a permission key');

const CreateTemplateSchema = z.object({
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(255).optional(),
  /** Offered in the tenant portal. Without it the template is system-only. */
  isTenant: z.boolean().default(false),
  displayOrder: z.coerce.number().int().min(0).max(10_000).default(0),
  scopes: z.array(ScopeSchema).min(1).max(500),
});

const UpdateTemplateSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  description: z.string().trim().max(255).optional(),
  isTenant: z.boolean().optional(),
  displayOrder: z.coerce.number().int().min(0).max(10_000).optional(),
  scopes: z.array(ScopeSchema).min(1).max(500).optional(),
  status: StatusEnum.optional(),
});

const TemplateListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  search: z.string().trim().max(150).optional(),
  status: StatusEnum.optional(),
  isTenant: z.enum(['true', 'false']).optional(),
});

export class CreateTemplateDto extends createZodDto(CreateTemplateSchema) {}
export class UpdateTemplateDto extends createZodDto(UpdateTemplateSchema) {}
export class TemplateListQueryDto extends createZodDto(TemplateListQuerySchema) {}
