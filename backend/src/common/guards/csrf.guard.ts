import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

export const CSRF_COOKIE = 'csrf_token';
export const REFRESH_COOKIE = 'refresh_token';
export const CSRF_HEADER = 'x-csrf-token';

/**
 * Double-submit-cookie CSRF protection for cookie-based endpoints
 * (refresh / logout, which rely on the httpOnly refresh_token cookie).
 * The non-httpOnly `csrf_token` cookie issued at login must be echoed
 * back in the `x-csrf-token` header.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // Cookie-based clients only. A native app authenticates with a refresh
    // token in the request body and sets no cookies, so there is nothing for
    // a cross-site request to ride and CSRF does not apply.
    //
    // Keyed on the refresh COOKIE being present, never on `x-device-type`:
    // that header is client-supplied, so branching a security control on it
    // would let anything that can set a header opt out of CSRF.
    if (!request.cookies?.[REFRESH_COOKIE]) return true;

    const cookieToken = request.cookies?.[CSRF_COOKIE];
    const headerToken = request.headers[CSRF_HEADER];
    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      throw new ForbiddenException('CSRF token mismatch');
    }
    return true;
  }
}
