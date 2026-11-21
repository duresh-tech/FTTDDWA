import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const KeyTypeEnum = z.enum(['LIVE', 'TEST']);
const KeyStatusEnum = z.enum(['ACTIVE', 'SUSPENDED', 'REVOKED']);

/** A scope is a permission key from the existing RBAC vocabulary. */
const ScopeSchema = z.string().regex(/^[a-z0-9-]+:[a-z0-9_-]+$/, 'Not a permission key');

const CreateApiKeySchema = z.object({
  title: z.string().trim().min(1).max(150),
  description: z.string().trim().max(255).optional(),
  keyType: KeyTypeEnum.default('TEST'),
  /** Ignored on the tenant surface, which forces the caller's own business. */
  tenantBusinessId: z.string().max(36).optional(),
  scopes: z.array(ScopeSchema).max(500).default([]),
  /** UNIX seconds. Null/absent means the key never expires. */
  expiresAt: z.coerce.number().int().positive().optional(),
});

// keyType and tenantBusinessId are absent on purpose: a key's type is baked
// into its prefix, and moving a key between businesses would silently change
// who its data belongs to. Issue a new key instead.
const UpdateApiKeySchema = z.object({
  title: z.string().trim().min(1).max(150).optional(),
  description: z.string().trim().max(255).optional(),
  status: KeyStatusEnum.exclude(['REVOKED']).optional(),
  scopes: z.array(ScopeSchema).max(500).optional(),
  expiresAt: z.coerce.number().int().positive().nullable().optional(),
});

const RevokeApiKeySchema = z.object({
  reason: z.string().trim().max(255).optional(),
});

const ApiKeyListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(150).optional(),
  status: KeyStatusEnum.optional(),
  keyType: KeyTypeEnum.optional(),
});

export class CreateApiKeyDto extends createZodDto(CreateApiKeySchema) {}
export class UpdateApiKeyDto extends createZodDto(UpdateApiKeySchema) {}
export class RevokeApiKeyDto extends createZodDto(RevokeApiKeySchema) {}
export class ApiKeyListQueryDto extends createZodDto(ApiKeyListQuerySchema) {}
