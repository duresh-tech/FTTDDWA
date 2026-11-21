import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  ThrottlerModuleOptions,
  ThrottlerRequest,
  ThrottlerStorage,
} from '@nestjs/throttler';
import { DEVICE_HEADER, isAppDevice } from './device-header.guard';

/**
 * Rate limiting that knows a phone from a browser.
 *
 * Limits are keyed on IP, and mobile users sit behind carrier NAT - thousands
 * of unrelated subscribers can share one address. The browser-sized budget
 * (THROTTLE_LIMIT) would therefore lock out whole carrier ranges as soon as
 * the apps ship, so app device types get THROTTLE_LIMIT_APP instead.
 *
 * This only ever RAISES the ceiling, and only for the global throttler - a
 * route carrying its own `@Throttle()` (login, the setup endpoints) keeps its
 * explicit limit, because that is a deliberate security decision rather than
 * a capacity one.
 *
 * Note this is a mitigation, not a fix: one abusive app client still shares a
 * bucket with its carrier neighbours. Throttling sign-in per account rather
 * than per address is the real answer - see docs/guide/security.
 */
@Injectable()
export class DeviceAwareThrottlerGuard extends ThrottlerGuard {
  private readonly defaultLimit: number;
  private readonly appLimit: number;

  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
    config: ConfigService,
  ) {
    super(options, storageService, reflector);
    this.defaultLimit = parseInt(config.get('THROTTLE_LIMIT', '100'), 10);
    this.appLimit = parseInt(config.get('THROTTLE_LIMIT_APP', '1000'), 10);
  }

  protected async handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
    const request = requestProps.context.switchToHttp().getRequest();

    // Read the RAW header, not request.deviceType: the global guard order is
    // throttle -> device header -> JWT -> RBAC (app.module.ts), so this runs
    // FIRST and DeviceHeaderGuard has not populated request.deviceType yet.
    // An invalid value simply fails to match and DeviceHeaderGuard rejects
    // the request immediately afterwards.
    //
    // The header is self-declared, so a browser client could claim an app
    // device type to get the larger budget. That is accepted: this is a
    // CAPACITY knob, not a security control - the limits that matter
    // (login, setup) are per-route and untouched below.
    //
    // Widen ONLY the global default. A resolved limit that differs from it
    // came from a route's own @Throttle() - login's 5/min, the setup
    // endpoints' 5/min - and those are security decisions that must stand
    // for apps exactly as they do for browsers.
    //
    // (A route that explicitly sets a limit equal to THROTTLE_LIMIT would be
    // widened too. Nothing does, and the alternative - reading the throttler
    // metadata back out - buys little for the complexity.)
    const declaredDevice = request?.headers?.[DEVICE_HEADER];
    if (isAppDevice(declaredDevice) && requestProps.limit === this.defaultLimit) {
      return super.handleRequest({ ...requestProps, limit: this.appLimit });
    }

    return super.handleRequest(requestProps);
  }
}
