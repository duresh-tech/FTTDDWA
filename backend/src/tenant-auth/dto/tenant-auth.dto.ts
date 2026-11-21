import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const TenantLoginSchema = z.object({
  username: z.string().min(3).max(191),
  password: z.string().min(8).max(128),
});

/**
 * Refresh / logout body.
 *
 * Browsers send nothing here: the refresh token travels in the httpOnly
 * cookie. Native apps have no cookie jar, so they post the token they were
 * given at login instead (docs/guide/mobile-clients).
 */
const TenantRefreshSchema = z.object({
  refreshToken: z.string().min(1).max(512).optional(),
});

export class TenantLoginDto extends createZodDto(TenantLoginSchema) {}
export class TenantRefreshDto extends createZodDto(TenantRefreshSchema) {}
