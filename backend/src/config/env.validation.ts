import { z } from 'zod';

/**
 * Boot-time environment validation.
 *
 * `ConfigModule` does not validate anything by default, which made several
 * failure modes silent: a typo'd variable simply became `undefined`, and an
 * empty CORS_ORIGINS left `origin: false` in main.ts -- disabling every
 * cross-origin browser request with no warning. Containers make that worse,
 * because nobody reads the logs until something is already broken.
 *
 * Anything invalid here aborts startup with a readable message instead.
 */

const PLACEHOLDER_SECRET = /change-me-in-production/i;

const booleanish = (defaultValue: 'true' | 'false') =>
  z.enum(['true', 'false']).default(defaultValue);

const intIn = (min: number, max: number, defaultValue: number) =>
  z.coerce.number().int().min(min).max(max).default(defaultValue);

const baseSchema = z.object({
  // ---- App ----
  APP_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: intIn(1, 65535, 4000),
  APP_NAME: z.string().min(1).default('FTTDDWA'),
  API_VERSION: z.string().regex(/^\d+$/, 'API_VERSION must be a number').default('1'),

  // ---- Database ----
  // In Docker this is composed from POSTGRES_* by docker/entrypoint.sh, so the
  // database name has a single source of truth.
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required')
    .refine(
      (value) => value.startsWith('postgresql://') || value.startsWith('postgres://'),
      'DATABASE_URL must be a postgresql:// connection string (this app is Postgres-only)',
    ),

  // ---- Auth ----
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().min(1).default('15m'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_REFRESH_EXPIRES_IN: z.string().min(1).default('7d'),
  COOKIE_SECURE: booleanish('false'),

  // ---- Reverse proxy ----
  // Hop count (usually '1') when a proxy fronts the API, so Express resolves
  // the real client address for rate limiting. Empty trusts nothing. See the
  // block in main.ts for why this is a count and not `true` or an IP list.
  TRUST_PROXY: z.string().trim().optional(),

  // ---- Domains and the edge (docs/guide/domains) ----
  // Hostnames of the SYSTEM console, comma separated, no port. Read once at
  // startup, so a change needs --force-recreate rather than a restart.
  SYSTEM_PORTAL_HOSTS: z.string().trim().optional(),
  // Shared secret the edge sends with its on-demand TLS check. Empty accepts
  // the ask unauthenticated, which is fine locally because the console
  // gateway 404s that path publicly.
  EDGE_ASK_KEY: z
    .string()
    .trim()
    .refine((v) => v === '' || v.length >= 16, 'EDGE_ASK_KEY must be at least 16 characters when set')
    .optional(),

  // ---- Encryption at rest (docs/guide/configuration) ----
  // AES-256 key for values that must come back out again: the console's API
  // key, and encrypted settings later. OPTIONAL - when unset it is derived
  // from JWT_ACCESS_SECRET via HKDF, so a fresh install needs no edit here
  // before the setup wizard can run. Set it explicitly on anything
  // long-lived: with the fallback, rotating JWT_ACCESS_SECRET makes every
  // stored encrypted value unreadable. `openssl rand -hex 32`.
  SETTINGS_ENCRYPTION_KEY: z
    .string()
    .trim()
    .refine(
      (v) => v === '' || /^[0-9a-fA-F]{64}$/.test(v),
      'SETTINGS_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes) when set',
    )
    .optional(),

  // ---- CORS ----
  // Must be non-empty: main.ts turns an empty list into `origin: false`.
  CORS_ORIGINS: z
    .string()
    .min(1, 'CORS_ORIGINS must list at least one browser origin, e.g. http://localhost:3000')
    .refine(
      (value) => value.split(',').some((origin) => origin.trim().length > 0),
      'CORS_ORIGINS must list at least one non-empty origin',
    ),

  // ---- Rate limiting ----
  THROTTLE_TTL_MS: intIn(1000, 3_600_000, 60_000),
  THROTTLE_LIMIT: intIn(1, 100_000, 100),
  // Budget for native app device types. Mobile users share carrier NAT
  // addresses, so the browser-sized limit would lock out whole ranges.
  // Only widens the global default; per-route limits (login, setup) stand.
  THROTTLE_LIMIT_APP: intIn(1, 1_000_000, 1000),

  // ---- Storage ----
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  LOCAL_STORAGE_DIR: z.string().min(1).default('public/uploads'),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),

  // ---- Swagger ----
  SWAGGER_ENABLED: booleanish('true'),
  SWAGGER_PATH: z.string().min(1).default('docs'),
});

const envSchema = baseSchema
  // S3 credentials are only required once the s3 driver is selected. This
  // mirrors StorageService's getOrThrow checks, but fails at boot rather than
  // on the first upload.
  .superRefine((env, ctx) => {
    if (env.STORAGE_DRIVER !== 's3') return;
    for (const key of ['S3_BUCKET', 'S3_REGION', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'] as const) {
      if (!env[key]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} is required when STORAGE_DRIVER=s3`,
        });
      }
    }
  })
  // Production-only hardening. Keyed off APP_ENV so host-native development
  // keeps booting with the committed example values.
  .superRefine((env, ctx) => {
    if (env.APP_ENV !== 'production') return;

    for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const) {
      if (PLACEHOLDER_SECRET.test(env[key])) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} still holds the example placeholder; generate one with \`openssl rand -hex 32\``,
        });
      }
    }

    if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_REFRESH_SECRET'],
        message: 'JWT_REFRESH_SECRET must differ from JWT_ACCESS_SECRET',
      });
    }

    if (env.COOKIE_SECURE !== 'true') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['COOKIE_SECURE'],
        message: 'COOKIE_SECURE must be true in production (auth cookies are sameSite=strict over HTTPS)',
      });
    }
  });

export type ValidatedEnv = z.infer<typeof baseSchema>;

/** Passed to `ConfigModule.forRoot({ validate })`. */
export function validateEnv(raw: Record<string, unknown>): Record<string, unknown> {
  const result = envSchema.safeParse(raw);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  // Keep any extra variables (PATH, NODE_ENV, POSTGRES_*, ...) alongside the
  // parsed+defaulted ones so ConfigService still sees the full environment.
  return { ...raw, ...result.data };
}
