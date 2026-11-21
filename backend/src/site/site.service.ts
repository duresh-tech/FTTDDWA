import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Which hostname is which.
 *
 * One business is reached at its own domain; the system console is reached at
 * the hosts named in SYSTEM_PORTAL_HOSTS. This service answers two questions:
 *
 *   - may the edge get a TLS certificate for this hostname? (isServedHost)
 *   - whose portal is this request on?                      (resolveForRequest)
 *
 * See docs/guide/domains.
 */

/** A business, as the console needs it to brand a page. */
export interface SiteBusiness {
  id: string;
  name: string;
  tagLine: string | null;
  logoPath: string | null;
}

export type SiteResolution =
  | { kind: 'system'; business?: undefined }
  | { kind: 'tenant'; business: SiteBusiness }
  | { kind: 'unknown'; business?: undefined };

/**
 * The domain list is re-read at most this often. Short enough that a domain
 * added in the console works almost immediately - including for certificate
 * issuance - without a restart, and long enough that the edge asking about
 * an unknown hostname cannot turn into a query per TLS handshake.
 */
const CACHE_MS = 15_000;

/** localhost and *.localhost always resolve to this machine (RFC 6761). */
export function isLocalName(host: string): boolean {
  return host === 'localhost' || host.endsWith('.localhost');
}

const HOSTNAME_PATTERN =
  /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/;

/**
 * `https://App.Example.com:3000/x` or `app.example.com.` -> `app.example.com`.
 * Returns null when the input is not a usable hostname.
 *
 * Every write AND every lookup goes through this, which is what lets the
 * column be a plain VarChar instead of citext: nothing ever compares a
 * hostname that has not been lowercased first.
 */
export function normalizeHost(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = raw.trim().toLowerCase();
  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, ''); // scheme
  value = value.split(/[/?#]/)[0]; // path, query, fragment
  value = value.replace(/:\d+$/, ''); // port
  value = value.replace(/\.$/, ''); // trailing dot
  if (!HOSTNAME_PATTERN.test(value)) return null;
  return value;
}

@Injectable()
export class SiteService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SiteService.name);

  /** Hosts of the SYSTEM console, from env. Parsed once. */
  private readonly systemHosts: Set<string>;

  private cache: { at: number; byHost: Map<string, SiteBusiness> } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.systemHosts = new Set(
      (this.config.get<string>('SYSTEM_PORTAL_HOSTS') ?? '')
        .split(',')
        .map((host) => normalizeHost(host))
        .filter((host): host is string => host !== null),
    );
  }

  /**
   * The fresh-install trap: on a new server there are no business domains
   * yet, so without SYSTEM_PORTAL_HOSTS no hostname can get a certificate -
   * including the console you would use to add the first domain. The browser
   * shows only ERR_SSL_PROTOCOL_ERROR, with nothing useful anywhere, so warn
   * about it at startup rather than leaving it to be discovered.
   */
  async onApplicationBootstrap(): Promise<void> {
    if (this.systemHosts.size > 0) return;
    const domains = await this.prisma.tenantBusinessDomain
      .count({ where: { enabled: true } })
      .catch(() => 0);
    if (domains > 0) return;

    this.logger.warn(
      'SYSTEM_PORTAL_HOSTS is empty and no business domain exists, so the edge ' +
        'can obtain an HTTPS certificate for no hostname at all and browsers will ' +
        'report ERR_SSL_PROTOCOL_ERROR. Set SYSTEM_PORTAL_HOSTS in backend/.env to ' +
        "the console's hostname and recreate the API (it is read once at startup). " +
        'Local *.localhost names are unaffected. See docs/guide/domains.',
    );
  }

  /** Enabled domains of live businesses, keyed by hostname. Cached. */
  private async domains(): Promise<Map<string, SiteBusiness>> {
    if (this.cache && Date.now() - this.cache.at < CACHE_MS) return this.cache.byHost;

    const rows = await this.prisma.tenantBusinessDomain.findMany({
      where: {
        enabled: true,
        tenantBusiness: { deletedAt: null, status: 'ACTIVE' },
      },
      select: {
        hostname: true,
        tenantBusiness: {
          select: { id: true, name: true, tagLine: true, logoPath: true },
        },
      },
    });

    const byHost = new Map(rows.map((row) => [row.hostname, row.tenantBusiness]));
    this.cache = { at: Date.now(), byHost };
    return byHost;
  }

  /** Drops the cache, so a just-saved domain resolves on the next request. */
  invalidate(): void {
    this.cache = null;
  }

  /** True when this hostname is one we serve, so the edge may get a cert. */
  async isServedHost(rawHost: string): Promise<boolean> {
    const host = normalizeHost(rawHost);
    if (!host) {
      this.logger.warn(`No certificate for "${rawHost}": not a usable hostname`);
      return false;
    }
    if (this.systemHosts.has(host)) return true;
    if ((await this.domains()).has(host)) return true;

    // A refusal is otherwise completely invisible: Caddy reads any non-2xx as
    // "deny" and the browser shows only ERR_SSL_PROTOCOL_ERROR. Say what to do.
    this.logger.warn(
      `No certificate for "${host}": it is not an enabled business domain, and ` +
        (this.systemHosts.size > 0
          ? `not in SYSTEM_PORTAL_HOSTS (${[...this.systemHosts].join(', ')}). `
          : 'SYSTEM_PORTAL_HOSTS is empty. ') +
        'Add it under Tenant Business Domains, or name it in SYSTEM_PORTAL_HOSTS ' +
        'in backend/.env and recreate the API. See docs/guide/domains.',
    );
    return false;
  }

  /**
   * The page's host. Origin first: in host-native development the API runs on
   * a different port than the page, so the request's own Host would be the
   * API's rather than the browser's.
   */
  hostOf(req: Request): string | null {
    const origin = req.headers.origin;
    if (origin && origin !== 'null') return normalizeHost(origin);
    const forwarded = req.headers['x-forwarded-host'];
    if (typeof forwarded === 'string' && forwarded) return normalizeHost(forwarded);
    return normalizeHost(req.hostname);
  }

  /** Whose portal this request is on. */
  async resolveForRequest(req: Request): Promise<SiteResolution> {
    const host = this.hostOf(req);
    if (!host) return { kind: 'system' };

    const business = (await this.domains()).get(host);
    if (business) return { kind: 'tenant', business };

    // An empty SYSTEM_PORTAL_HOSTS means "any host is the console", which is
    // the local-development default. Once it is set, a hostname that is
    // neither listed nor a business domain is genuinely unknown.
    if (this.systemHosts.size === 0 || this.systemHosts.has(host) || isLocalName(host)) {
      return { kind: 'system' };
    }
    return { kind: 'unknown' };
  }

  /** The hostnames reserved for the console, for the create-time check. */
  isReservedHost(host: string): boolean {
    return this.systemHosts.has(host) || host === 'localhost';
  }
}
