import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Caddy's on-demand TLS check. It appends ?domain=<host> to the ask URL
 * itself; `key` is the shared secret we put there (EDGE_ASK_KEY).
 */
const AllowedQuerySchema = z.object({
  domain: z.string().min(1).max(260),
  key: z.string().max(200).optional(),
});

const CreateDomainSchema = z.object({
  tenantBusinessId: z.string().min(1).max(36),
  hostname: z.string().min(1).max(253),
  enabled: z.boolean().default(true),
});

const UpdateDomainSchema = z.object({
  enabled: z.boolean().optional(),
});

const DomainListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  search: z.string().trim().max(253).optional(),
  tenantBusinessId: z.string().max(36).optional(),
  enabled: z.enum(['true', 'false']).optional(),
});

export class AllowedQueryDto extends createZodDto(AllowedQuerySchema) {}
export class CreateDomainDto extends createZodDto(CreateDomainSchema) {}
export class UpdateDomainDto extends createZodDto(UpdateDomainSchema) {}
export class DomainListQueryDto extends createZodDto(DomainListQuerySchema) {}
