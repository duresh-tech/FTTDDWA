import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { BULK_LIMIT } from '../tenant-id-cards.service';

const GenerateIdCardSchema = z.object({
  /** Omit to use the business's default template. */
  templateId: z.string().uuid().optional(),
});

/**
 * Explicit member ids rather than a filter.
 *
 * A filter would make "print everybody" a single click whose meaning changes
 * as the register changes, and the operator could not see beforehand how many
 * cards they were about to produce. The cap is enforced again in the service.
 */
const BulkGenerateIdCardsSchema = z.object({
  memberIds: z.array(z.string().uuid()).min(1).max(BULK_LIMIT),
  templateId: z.string().uuid().optional(),
});

export class GenerateIdCardDto extends createZodDto(GenerateIdCardSchema) {}
export class BulkGenerateIdCardsDto extends createZodDto(BulkGenerateIdCardsSchema) {}
