import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { SystemAccountSchema } from '../../auth/dto/auth.dto';

/**
 * Storage paths accepted for the branding logo.
 *
 * Pinned to the folder POST /system/setup/logo writes into, and to the
 * filename shape StorageService produces (`${uuidv7}${ext}`). Because
 * `initialize` is a public endpoint, an unconstrained string here would let a
 * caller write an arbitrary path into the `app.logo_path` setting.
 */
const LOGO_PATH_PATTERN = /^app_settings_uploads\/[A-Za-z0-9-]+\.(png|jpe?g|svg|webp)$/;

const InitializeSchema = z.object({
  // Same field rules as any other system account - imported, not restated.
  admin: SystemAccountSchema,
  branding: z.object({
    appName: z.string().trim().min(1).max(100),
    logoPath: z
      .string()
      .regex(LOGO_PATH_PATTERN, 'logoPath must be a path returned by /system/setup/logo')
      .nullish(),
  }),
  /**
   * Also create a tenant-visible role. Without one, no tenant user can be
   * created (TenantUsersService requires a role with visibleToTenants=true),
   * so the tenant portal would be unreachable.
   */
  createTenantRole: z.boolean().default(false),
});

export class InitializeSetupDto extends createZodDto(InitializeSchema) {}
