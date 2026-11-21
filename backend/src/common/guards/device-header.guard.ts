import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SKIP_DEVICE_HEADER_KEY } from '../decorators/skip-device-header.decorator';

export const DEVICE_HEADER = 'x-device-type';
export const ALLOWED_DEVICES = [
  'website',
  'androidApp',
  'iosApp',
  'desktopApp',
] as const;

export type DeviceType = (typeof ALLOWED_DEVICES)[number];

/**
 * Device types that are native apps rather than a browser.
 *
 * They get the refresh token in the response body instead of an httpOnly
 * cookie, because a native client has no cookie jar worth maintaining and no
 * CSRF exposure. See docs/guide/mobile-clients.
 *
 * NOTE: this is derived from a CLIENT-SUPPLIED header, so it may decide where
 * a token is RETURNED, but it must never decide whether a security control
 * runs. The CSRF guards key off whether a refresh cookie is actually present.
 */
export const APP_DEVICES: readonly DeviceType[] = ['androidApp', 'iosApp', 'desktopApp'];

export function isAppDevice(deviceType?: string): boolean {
  return APP_DEVICES.includes(deviceType as DeviceType);
}

/**
 * Every API request must declare the calling device via the
 * `x-device-type` header (website | androidApp | iosApp | desktopApp).
 * Native mobile apps send it too - see docs/guide/mobile-clients.
 *
 * There is ONE bypass, `@SkipDeviceHeader()`, for callers that cannot send a
 * header at all (Caddy's on-demand TLS check). Everything else, including
 * health probes, sends the header.
 */
@Injectable()
export class DeviceHeaderGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_DEVICE_HEADER_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const request = context.switchToHttp().getRequest();
    const device = request.headers[DEVICE_HEADER];
    if (!device || !ALLOWED_DEVICES.includes(device)) {
      throw new BadRequestException(
        `Missing or invalid "${DEVICE_HEADER}" header. Allowed: ${ALLOWED_DEVICES.join(', ')}`,
      );
    }
    request.deviceType = device;
    return true;
  }
}
