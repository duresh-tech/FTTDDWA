import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { SKIP_API_KEY_KEY } from '../common/decorators/skip-api-key.decorator';
import { ApiKeysService, ApiKeyPrincipal, KEY_BRAND } from './api-keys.service';

export const API_KEY_SCOPES = 'apiKeyScopes';

/**
 * States what a key must be allowed to do on this route.
 *
 *   @RequireApiScopes('tenant-members:list')
 *
 * A route with no scopes listed still requires a valid key, but accepts any
 * scope set - a valid key is authentication of the calling application, and
 * on console routes the signed-in user's RBAC is still the authorisation.
 */
export const RequireApiScopes = (...scopes: string[]) => SetMetadata(API_KEY_SCOPES, scopes);

/**
 * Authenticates the calling application.
 *
 * Registered globally and **fails closed**: every route needs a valid key
 * unless it carries `@SkipApiKey()`. Applying the guard without a decorator
 * must never mean "allow everything" - that is the wrong direction for a
 * security default.
 *
 * Runs before the JWT guards, so an unknown client is rejected without the
 * cost of resolving a user and its role permissions.
 *
 * The console has a key of its own, issued by the bootstrap and served to it
 * at run time by GET /system/setup/status - so the console is an ordinary
 * client here, with nothing special-cased for it.
 *
 * /uploads is NOT covered by this guard: app.useStaticAssets() mounts static
 * files on the Express adapter, outside Nest's pipeline. That is deliberate -
 * an <img src> cannot send a header.
 *
 * See docs/guide/api-keys.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly apiKeys: ApiKeysService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_API_KEY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const required =
      this.reflector.getAllAndOverride<string[] | undefined>(API_KEY_SCOPES, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    const request = context.switchToHttp().getRequest<Request>();
    const token = extractToken(request);
    if (!token) {
      throw new UnauthorizedException(
        `Provide an API key as "Authorization: Bearer <key>" or the x-api-key header`,
      );
    }

    const principal = await this.apiKeys.verify(token, clientIp(request));

    if (required.length > 0) {
      // A key never outranks its owner. Intersecting with the owner's CURRENT
      // role permissions means revoking a permission from the role narrows
      // every key that leaned on it, on the next request - rather than
      // leaving a stale credential holding a scope its owner has lost.
      const owner = await this.apiKeys.ownerPermissions(principal.tenantBusinessId);
      const effective =
        owner === null
          ? new Set(principal.scopes)
          : new Set(principal.scopes.filter((scope) => owner.includes(scope)));

      const missing = required.filter((scope) => !effective.has(scope));
      if (missing.length > 0) {
        throw new ForbiddenException(
          `This API key is missing the scope: ${missing.join(', ')}`,
        );
      }
    }

    // Downstream handlers read this instead of a user session. A business key
    // carries its own tenancy, so a handler cannot accidentally serve another
    // business's data by trusting a body parameter.
    (request as Request & { apiKey?: ApiKeyPrincipal }).apiKey = principal;
    return true;
  }
}

function extractToken(request: Request): string | null {
  const header = request.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    const value = header.slice(7).trim();
    // Session JWTs also arrive as Bearer tokens. An API key always carries
    // the brand prefix, so this does not swallow a JWT and then report it as
    // a malformed key.
    if (value.startsWith(`${KEY_BRAND}_`)) return value;
  }
  const alt = request.headers['x-api-key'];
  if (typeof alt === 'string' && alt.trim() !== '') return alt.trim();
  return null;
}

function clientIp(request: Request): string | undefined {
  // request.ip already honours `trust proxy`, which main.ts configures.
  return request.ip?.slice(0, 45);
}
