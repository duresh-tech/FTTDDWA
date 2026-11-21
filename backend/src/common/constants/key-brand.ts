/**
 * The brand that marks an API-key token as one of ours: tokens are spelled
 * `fttddwa_<type>_<8 hex>.<secret>`.
 *
 * It lives here, in a file that imports nothing, rather than beside the
 * service, because three callers need it and two of them must stay free of
 * Nest's DI graph:
 *
 *   - `ApiKeysService` generates a tenant or platform key's prefix.
 *   - `ApiKeyGuard` uses it to tell an API key from a session JWT when both
 *     arrive as `Authorization: Bearer`.
 *   - `common/bootstrap/bootstrap.ts` issues the console's own key, and is
 *     also imported by the standalone `prisma/seed.ts` script - which cannot
 *     load `PrismaService` or `@nestjs/common` decorators.
 *
 * The generator and the extractor must agree, so changing it in one place
 * only would make every key unreadable. Changing it at all invalidates every
 * key already issued, the console's included.
 */
export const KEY_BRAND = 'fttddwa';
