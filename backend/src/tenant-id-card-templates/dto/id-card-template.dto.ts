import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  CARD_HEIGHT_MM,
  CARD_WIDTH_MM,
  IdCardLayoutSchema,
} from '../../tenant-id-cards/id-card-layout.schema';

const StatusEnum = z.enum(['ACTIVE', 'INACTIVE', 'DELETED']);

// max() mirrors the Prisma VarChar exactly.
const CreateIdCardTemplateSchema = z.object({
  tenantBusinessId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(255).optional(),
  /** Millimetres. CR80 is the standard ID card and the default. */
  widthMm: z.number().min(20).max(500).default(CARD_WIDTH_MM),
  heightMm: z.number().min(20).max(500).default(CARD_HEIGHT_MM),
  /**
   * Optional on create: a new template starts as an empty card of the given
   * size, which is what the designer then edits. Supplying one duplicates an
   * existing design.
   */
  layout: IdCardLayoutSchema.optional(),
  isDefault: z.boolean().optional(),
});

/**
 * `status` is absent from create and added here with DELETED excluded, so a
 * row can only reach DELETED through the DELETE endpoint - never a PATCH that
 * would bypass the soft-delete bookkeeping.
 *
 * The whole `layout` is replaced rather than patched: the designer holds the
 * canvas as its single source of truth while editing and saves it once, and a
 * deep merge of positioned elements has no sensible meaning anyway.
 */
const UpdateIdCardTemplateSchema = CreateIdCardTemplateSchema.partial().extend({
  status: StatusEnum.exclude(['DELETED']).optional(),
});

export class CreateIdCardTemplateDto extends createZodDto(CreateIdCardTemplateSchema) {}
export class UpdateIdCardTemplateDto extends createZodDto(UpdateIdCardTemplateSchema) {}
