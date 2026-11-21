import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const LoginSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(191)
    .describe('Username or email of the system user'),
  password: z.string().min(8).max(128),
});

/**
 * Field rules for creating a system account.
 *
 * Exported (rather than inlined into a single DTO) because the first-run setup
 * wizard creates the initial SYSTEM_SUPER_ADMIN account and must enforce
 * exactly the same constraints -- restating them would let the two drift.
 *
 * The old `@Public()` register endpoint that used to own this schema has been
 * removed: it made whoever registered first a super admin, which the setup
 * wizard now owns. Authenticated creation lives at POST /api/v1/system/users.
 */
export const SystemAccountSchema = z.object({
  fName: z.string().min(1).max(100),
  username: z
    .string()
    .min(3)
    .max(50)
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      'Username may only contain letters, numbers, dot, underscore and hyphen',
    ),
  email: z.string().email().max(191),
  password: z
    .string()
    .min(8)
    .max(128)
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[0-9]/, 'Password must contain a digit'),
});

/**
 * Refresh / logout body.
 *
 * Browsers send nothing here: the refresh token travels in the httpOnly
 * cookie. Native apps have no cookie jar, so they post the token they were
 * given at login instead (docs/guide/mobile-clients).
 */
const RefreshSchema = z.object({
  refreshToken: z.string().min(1).max(512).optional(),
});

export class LoginDto extends createZodDto(LoginSchema) {}
export class RefreshDto extends createZodDto(RefreshSchema) {}
