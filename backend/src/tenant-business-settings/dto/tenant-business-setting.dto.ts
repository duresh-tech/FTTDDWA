import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Every value crosses the wire as a string, whatever the setting's valueType
 * says. Typing it here would mean a union per type and a discriminator the
 * client has to get right; instead the value is validated at runtime against
 * the valueType and validationRules stored on the row itself.
 */
const UpdateTenantBusinessSettingSchema = z.object({
  settingValue: z.string().max(100000).optional(),
  /** Locks or unlocks this setting for THIS business only. */
  isReadonly: z.coerce.boolean().optional(),
});

const BatchUpdateTenantBusinessSettingSchema = z.object({
  updates: z
    .array(
      z.object({
        settingKey: z.string().min(1).max(150),
        settingValue: z.string().max(100000),
      }),
    )
    .min(1)
    .max(100),
});

export class UpdateTenantBusinessSettingDto extends createZodDto(
  UpdateTenantBusinessSettingSchema,
) {}
export class BatchUpdateTenantBusinessSettingDto extends createZodDto(
  BatchUpdateTenantBusinessSettingSchema,
) {}
