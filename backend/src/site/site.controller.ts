import { Controller, Get, NotFoundException, Query, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { timingSafeEqual } from 'crypto';
import type { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { SkipDeviceHeader } from '../common/decorators/skip-device-header.decorator';
import { SiteService } from './site.service';
import { AllowedQueryDto } from './dto/site.dto';
import { SkipApiKey } from '../common/decorators/skip-api-key.decorator';

/**
 * Hostname questions, answered before anyone has signed in.
 *
 * Both routes are public by necessity: one is called by the TLS layer before
 * a certificate exists, the other by the console's root page before it knows
 * which portal to show.
 *
 * See docs/guide/domains.
 */
@ApiTags('Public / Site')
@Public()
// `allowed` is called by Caddy, which issues a bare GET and cannot set
// headers at all; `resolve` is called by the console's root page before the
// gateway is necessarily in front of it.
@SkipApiKey()
@Controller('public/site')
export class SiteController {
  constructor(
    private readonly site: SiteService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Which portal this hostname serves, for the console's root page.
   *
   * Throttled generously: `/` calls it on every load, so it must not eat the
   * global per-IP budget.
   */
  @Get('resolve')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Which portal this hostname serves',
    description:
      'Returns kind=tenant with the business when the host is an enabled ' +
      'business domain, kind=system for the console, kind=unknown otherwise.',
  })
  @ApiOkResponse({
    schema: {
      example: {
        kind: 'tenant',
        business: { id: '019f...', name: 'Acme Ltd', tagLine: null, logoPath: null },
      },
    },
  })
  async resolve(@Req() req: Request) {
    return this.site.resolveForRequest(req);
  }

  /**
   * Caddy's on-demand TLS check: may a certificate be issued for this
   * hostname? 200 to allow, 404 to refuse - Caddy reads any non-2xx as deny.
   *
   * @SkipDeviceHeader because Caddy issues a bare GET and `on_demand_tls ask`
   * has no header configuration at all.
   *
   * Unauthenticated by necessity, so it is defended three ways instead: the
   * console gateway hard-404s this path so no browser can reach it, the API
   * publishes no host port, and the edge passes a shared secret below. An IP
   * check is not viable - the edge reaches the API over the app network where
   * its address is DHCP-assigned, so its fixed proxy-network address would
   * never match.
   */
  @Get('allowed')
  @SkipDeviceHeader()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'May a certificate be issued for this hostname?',
    description:
      '200 for an enabled business domain or a SYSTEM_PORTAL_HOSTS entry, 404 ' +
      'otherwise. Called by the edge only; the console gateway refuses it.',
  })
  @ApiOkResponse({ schema: { example: { allowed: true } } })
  async allowed(@Query() query: AllowedQueryDto) {
    const expected = (this.config.get<string>('EDGE_ASK_KEY') ?? '').trim();

    // An unset key accepts the ask. The default no-edge stack never calls
    // this route, and the gateway 404s it publicly, so requiring a secret by
    // default would only break local runs that have not set one.
    if (expected && !safeEqual(query.key ?? '', expected)) {
      // Same 404 as an unknown hostname: a distinct error would confirm the
      // route exists and that the caller merely had the wrong key.
      throw new NotFoundException('Unknown hostname');
    }

    if (!(await this.site.isServedHost(query.domain))) {
      throw new NotFoundException('Unknown hostname');
    }
    return { allowed: true };
  }
}

/** Constant-time compare that tolerates differing lengths. */
function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
