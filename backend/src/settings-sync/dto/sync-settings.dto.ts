import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const SyncSettingsSchema = z
  .object({
    mode: z.enum(['ALL', 'SELECTED']),
    tenantBusinessIds: z.array(z.string().uuid()).max(500).optional(),
    /** Report what would be inserted without writing any setting rows. */
    dryRun: z.coerce.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if (
      data.mode === 'SELECTED' &&
      (!data.tenantBusinessIds || data.tenantBusinessIds.length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'tenantBusinessIds is required when mode is SELECTED',
        path: ['tenantBusinessIds'],
      });
    }
  });

export class SyncSettingsDto extends createZodDto(SyncSettingsSchema) {}
