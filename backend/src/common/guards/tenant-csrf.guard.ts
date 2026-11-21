import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

export const TENANT_CSRF_COOKIE = 'tenant_csrf_token';
export const TENANT_REFRESH_COOKIE = 'tenant_refresh_token';
export const TENANT_CSRF_HEADER = 'x-csrf-token';

/**
 * Double-submit-cookie CSRF protection for tenant cookie-based endpoints
 * (refresh / logout, which rely on the httpOnly tenant_refresh_token cookie).
 * Uses a distinct cookie name from the system CsrfGuard so a tenant session
 * and a system session don't clobber each other's CSRF cookie in the same
 * browser (both would otherwise sit at path: '/').
 */
@Injectable()
export class TenantCsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // Cookie-based clients only. A native app authenticates with a refresh
    // token in the request body and sets no cookies, so there is nothing for
    // a cross-site request to ride and CSRF does not apply.
    //
    // Keyed on the refresh COOKIE being present, never on `x-device-type`:
    // that header is client-supplied, so branching a security control on it
    // would let anything that can set a header opt out of CSRF.
    if (!request.cookies?.[TENANT_REFRESH_COOKIE]) return true;

    const cookieToken = request.cookies?.[TENANT_CSRF_COOKIE];
    const headerToken = request.headers[TENANT_CSRF_HEADER];
    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      throw new ForbiddenException('CSRF token mismatch');
    }
    return true;
  }
}
