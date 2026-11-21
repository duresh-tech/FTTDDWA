import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { listResponse, paginate } from '../common/dto/query.dto';
import { newId, newSystemCode, now } from '../common/utils/id.util';
import { KEY_BRAND } from '../common/constants/key-brand';
import {
  ApiKeyListQueryDto,
  CreateApiKeyDto,
  RevokeApiKeyDto,
  UpdateApiKeyDto,
} from './dto/api-key.dto';

/**
 * Re-exported so existing importers (`ApiKeyGuard`) keep one import site,
 * while the value itself lives in a DI-free file that `bootstrap.ts` - and
 * through it the standalone `prisma/seed.ts` - can also import.
 */
export { KEY_BRAND };

/** Longer than needed to be unguessable; short enough to read down a table. */
const SECRET_BYTES = 32;
const PREFIX_BYTES = 4;

/** Usage stamps are written at most this often per key. */
const TOUCH_INTERVAL_S = 60;

const KEY_INCLUDE = {
  scopes: { select: { permissionKey: true } },
  tenantBusiness: { select: { id: true, name: true, systemCode: true } },
} as const;

type KeyRow = {
  expiresAt: bigint | null;
  usageCount: bigint;
  scopes: { permissionKey: string }[];
  [key: string]: unknown;
};

/** Shapes a row for the API. Structurally cannot leak a secret. */
function serialize(row: KeyRow) {
  const { scopes, secretHash, ...rest } = row as KeyRow & { secretHash?: string };
  void secretHash;
  const expiresAt = row.expiresAt === null ? null : Number(row.expiresAt);
  return {
    ...rest,
    scopes: scopes.map((s) => s.permissionKey),
    expiresAt,
    usageCount: Number(row.usageCount),
    // Derived, never stored - see the ApiKeyStatus comment in the schema.
    isExpired: expiresAt !== null && expiresAt <= now(),
  };
}

export interface ApiKeyPrincipal {
  id: string;
  keyPrefix: string;
  keyType: 'LIVE' | 'TEST';
  /**
   * Set for a business key: the request is confined to this business, and a
   * handler must scope its queries to it rather than trusting a body
   * parameter. NULL means a platform-level key.
   */
  tenantBusinessId: string | null;
  scopes: string[];
}

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------- generation

  /**
   * SHA-256, deliberately not Argon2id. The secret is 32 bytes of CSPRNG
   * output, so there is no low-entropy guess space for a slow KDF to defend -
   * and verification runs on every API request, where a deliberately slow
   * hash would let anyone exhaust the CPU by posting garbage keys.
   */
  private hashSecret(secret: string): string {
    return createHash('sha256').update(secret).digest('hex');
  }

  private generateCredential(keyType: 'LIVE' | 'TEST') {
    const keyPrefix = `${KEY_BRAND}_${keyType.toLowerCase()}_${randomBytes(PREFIX_BYTES).toString('hex')}`;
    const secret = randomBytes(SECRET_BYTES).toString('base64url');
    return {
      keyPrefix,
      secret,
      /** What the caller sends back. Prefix first so it is greppable in logs. */
      token: `${keyPrefix}.${secret}`,
      secretHash: this.hashSecret(secret),
      secretLast4: secret.slice(-4),
    };
  }

  // ------------------------------------------------------------- reading

  async findAll(query: ApiKeyListQueryDto, tenantBusinessId?: string | null) {
    const where = {
      deletedAt: null,
      // undefined means "any business" (system view); null means
      // platform-level only; a string confines it to one business.
      ...(tenantBusinessId !== undefined ? { tenantBusinessId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.keyType ? { keyType: query.keyType } : {}),
      ...(query.search
        ? { title: { contains: query.search, mode: 'insensitive' as const } }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.apiKey.findMany({
        where,
        include: KEY_INCLUDE,
        orderBy: { createdAt: 'desc' },
        ...paginate(query.page, query.limit),
      }),
      this.prisma.apiKey.count({ where }),
    ]);

    return listResponse(items.map((row) => serialize(row as KeyRow)), total, query.page, query.limit);
  }

  async findOne(id: string, tenantBusinessId?: string) {
    const row = await this.prisma.apiKey.findFirst({
      where: { id, deletedAt: null, ...(tenantBusinessId ? { tenantBusinessId } : {}) },
      include: KEY_INCLUDE,
    });
    if (!row) throw new NotFoundException('API key not found');
    return serialize(row as KeyRow);
  }

  // ------------------------------------------------------------- writing

  /**
   * A key can only ever be a subset of its issuer. Enforced here rather than
   * trusted from the form, because the scope list arrives in the request body
   * and a caller can send whatever they like.
   */
  private assertScopesWithinActor(scopes: string[], actorPermissions: string[]) {
    const held = new Set(actorPermissions);
    const excess = [...new Set(scopes)].filter((scope) => !held.has(scope));
    if (excess.length > 0) {
      throw new ForbiddenException(
        `You cannot grant a key permissions you do not hold yourself: ${excess.join(', ')}`,
      );
    }
  }

  private async writeScopes(apiKeyId: string, scopes: string[]) {
    const unique = [...new Set(scopes)];
    await this.prisma.apiKeyScope.deleteMany({ where: { apiKeyId } });
    if (unique.length === 0) return;
    const timestamp = now();
    await this.prisma.apiKeyScope.createMany({
      data: unique.map((permissionKey) => ({ apiKeyId, permissionKey, createdAt: timestamp })),
      skipDuplicates: true,
    });
  }

  async create(
    dto: CreateApiKeyDto,
    actor: { permissions: string[]; systemUserId?: string; tenantUserId?: string },
    forcedBusinessId?: string,
  ) {
    this.assertScopesWithinActor(dto.scopes, actor.permissions);

    const tenantBusinessId = forcedBusinessId ?? dto.tenantBusinessId ?? null;
    if (tenantBusinessId) {
      const business = await this.prisma.tenantBusiness.findFirst({
        where: { id: tenantBusinessId, deletedAt: null },
        select: { id: true },
      });
      if (!business) throw new ConflictException('Business does not exist');
    }

    const credential = this.generateCredential(dto.keyType);
    const timestamp = now();

    const created = await this.prisma.apiKey.create({
      data: {
        id: newId(),
        systemCode: newSystemCode('AKY'),
        tenantBusinessId,
        title: dto.title,
        description: dto.description ?? null,
        keyType: dto.keyType,
        keyPrefix: credential.keyPrefix,
        secretHash: credential.secretHash,
        secretLast4: credential.secretLast4,
        expiresAt: dto.expiresAt ?? null,
        createdBySystemUserId: actor.systemUserId ?? null,
        createdByTenantUserId: actor.tenantUserId ?? null,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    });

    await this.writeScopes(created.id, dto.scopes);
    const row = await this.prisma.apiKey.findUnique({
      where: { id: created.id },
      include: KEY_INCLUDE,
    });

    return {
      ...serialize(row as KeyRow),
      /**
       * The only time this is ever returned. It is not stored, so it cannot
       * be recovered - a lost key is rotated, not looked up.
       */
      secret: credential.secret,
      token: credential.token,
      secretWarning:
        'Copy this now. It is hashed before storage and cannot be shown again - rotate the key if you lose it.',
    };
  }

  async update(
    id: string,
    dto: UpdateApiKeyDto,
    actor: { permissions: string[] },
    tenantBusinessId?: string,
  ) {
    const row = await this.prisma.apiKey.findFirst({
      where: { id, deletedAt: null, ...(tenantBusinessId ? { tenantBusinessId } : {}) },
    });
    if (!row) throw new NotFoundException('API key not found');
    if (row.status === 'REVOKED') {
      throw new ConflictException('A revoked key cannot be changed. Issue a new one.');
    }

    if (dto.scopes !== undefined) this.assertScopesWithinActor(dto.scopes, actor.permissions);

    const { scopes, ...rest } = dto;
    await this.prisma.apiKey.update({
      where: { id },
      data: { ...rest, updatedAt: now() },
    });
    if (scopes !== undefined) await this.writeScopes(id, scopes);

    return this.findOne(id, tenantBusinessId);
  }

  async rotate(id: string, tenantBusinessId?: string) {
    const row = await this.prisma.apiKey.findFirst({
      where: { id, deletedAt: null, ...(tenantBusinessId ? { tenantBusinessId } : {}) },
    });
    if (!row) throw new NotFoundException('API key not found');
    if (row.status === 'REVOKED') {
      throw new ConflictException('A revoked key cannot be rotated. Issue a new one.');
    }

    const credential = this.generateCredential(row.keyType);
    const timestamp = now();
    await this.prisma.apiKey.update({
      where: { id },
      data: {
        // The prefix moves too, so the previous one disappears from the table
        // and cannot be used to look the key up.
        keyPrefix: credential.keyPrefix,
        secretHash: credential.secretHash,
        secretLast4: credential.secretLast4,
        rotatedAt: timestamp,
        updatedAt: timestamp,
      },
    });

    return {
      ...(await this.findOne(id, tenantBusinessId)),
      secret: credential.secret,
      token: credential.token,
      secretWarning: 'Copy this now. The previous secret stopped working the moment this was issued.',
    };
  }

  async revoke(id: string, dto: RevokeApiKeyDto, tenantBusinessId?: string) {
    const row = await this.prisma.apiKey.findFirst({
      where: { id, deletedAt: null, ...(tenantBusinessId ? { tenantBusinessId } : {}) },
    });
    if (!row) throw new NotFoundException('API key not found');

    const timestamp = now();
    await this.prisma.apiKey.update({
      where: { id },
      data: {
        status: 'REVOKED',
        revokedAt: timestamp,
        revokedReason: dto.reason ?? null,
        updatedAt: timestamp,
        // Scrubbed so the row cannot authenticate even if the status check is
        // ever bypassed by a future query that forgets it.
        secretHash: '',
      },
    });

    return this.findOne(id, tenantBusinessId);
  }

  // --------------------------------------------------------- verification

  /**
   * Resolves a presented token to a principal, or throws.
   *
   * Called on every request that carries a key, so it is one indexed lookup
   * on the public prefix followed by a constant-time hash comparison - never
   * a scan, and never a string === on the secret.
   */
  async verify(token: string, ip?: string): Promise<ApiKeyPrincipal> {
    const separator = token.indexOf('.');
    if (separator < 1) throw new UnauthorizedException('Malformed API key');
    const keyPrefix = token.slice(0, separator);
    const secret = token.slice(separator + 1);
    if (!secret) throw new UnauthorizedException('Malformed API key');

    const key = await this.prisma.apiKey.findUnique({
      where: { keyPrefix },
      include: KEY_INCLUDE,
    });

    // One message for every failure below: distinguishing "no such key" from
    // "wrong secret" tells an attacker which prefixes are real.
    const rejected = () => new UnauthorizedException('Invalid API key');
    if (!key || key.deletedAt !== null || key.secretHash === '') throw rejected();

    const presented = Buffer.from(this.hashSecret(secret), 'hex');
    const stored = Buffer.from(key.secretHash, 'hex');
    if (presented.length !== stored.length || !timingSafeEqual(presented, stored)) {
      throw rejected();
    }

    if (key.status === 'REVOKED') throw new UnauthorizedException('This API key was revoked');
    if (key.status === 'SUSPENDED') throw new UnauthorizedException('This API key is suspended');
    if (key.expiresAt !== null && Number(key.expiresAt) <= now()) {
      throw new UnauthorizedException('This API key has expired');
    }

    void this.touch(key.id, key.lastUsedAt, ip);

    return {
      id: key.id,
      keyPrefix: key.keyPrefix,
      keyType: key.keyType,
      tenantBusinessId: key.tenantBusinessId,
      scopes: key.scopes.map((s) => s.permissionKey),
    };
  }

  /**
   * Usage stamp, fire-and-forget and rate-limited to once a minute per key.
   * Writing on every request would turn a read path into a write path and
   * make a busy key a row-lock hotspot; a minute is close enough for "when
   * was this last used" and for spotting a leaked key in the wild.
   *
   * usageCount is therefore sampled, not an exact request count.
   */
  private async touch(id: string, lastUsedAt: bigint | null, ip?: string) {
    const timestamp = now();
    if (lastUsedAt !== null && timestamp - Number(lastUsedAt) < TOUCH_INTERVAL_S) return;
    await this.prisma.apiKey
      .update({
        where: { id },
        data: { lastUsedAt: timestamp, lastUsedIp: ip ?? null, usageCount: { increment: 1 } },
      })
      .catch(() => {
        // Never fail a request because the usage stamp could not be written.
      });
  }

  /**
   * The permissions the key's owner currently holds, for the scope
   * intersection in the guard.
   *
   * A platform-level key has no owning role, so its stored scopes stand on
   * their own - it was issued by a system admin and is not tied to a user
   * whose role could later change.
   */
  async ownerPermissions(tenantBusinessId: string | null): Promise<string[] | null> {
    if (!tenantBusinessId) return null;

    const mappings = await this.prisma.tenantMappedBusiness.findMany({
      where: { tenantBusinessId, status: 'ACTIVE' },
      select: {
        tenantUser: {
          select: {
            status: true,
            role: {
              select: {
                status: true,
                rolePermissions: {
                  select: { permission: { select: { permissionKey: true, status: true } } },
                },
              },
            },
          },
        },
      },
    });

    const held = new Set<string>();
    for (const mapping of mappings) {
      const user = mapping.tenantUser;
      if (!user || user.status !== 'ACTIVE' || user.role?.status !== 'ACTIVE') continue;
      for (const rp of user.role.rolePermissions) {
        if (rp.permission.status === 'ACTIVE') held.add(rp.permission.permissionKey);
      }
    }
    return [...held];
  }
}
