import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { listResponse, paginate } from '../common/dto/query.dto';
import { newId, now } from '../common/utils/id.util';
import { normalizeHost, SiteService } from './site.service';
import { CreateDomainDto, DomainListQueryDto, UpdateDomainDto } from './dto/site.dto';

const DOMAIN_INCLUDE = {
  tenantBusiness: { select: { id: true, name: true, systemCode: true } },
} as const;

/**
 * System-admin CRUD for the hostnames a business's portal is served on.
 *
 * Deliberately hard-deletes, against this project's soft-delete convention: a
 * soft-deleted row would keep holding the unique hostname and block a
 * legitimate re-claim. `enabled` covers turning one off without losing it.
 */
@Injectable()
export class TenantBusinessDomainsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly site: SiteService,
  ) {}

  async findAll(query: DomainListQueryDto) {
    const where = {
      ...(query.tenantBusinessId ? { tenantBusinessId: query.tenantBusinessId } : {}),
      ...(query.enabled ? { enabled: query.enabled === 'true' } : {}),
      ...(query.search
        ? { hostname: { contains: query.search, mode: 'insensitive' as const } }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.tenantBusinessDomain.findMany({
        where,
        include: DOMAIN_INCLUDE,
        orderBy: { hostname: 'asc' },
        ...paginate(query.page, query.limit),
      }),
      this.prisma.tenantBusinessDomain.count({ where }),
    ]);

    return listResponse(items, total, query.page, query.limit);
  }

  async findOne(id: string) {
    const row = await this.prisma.tenantBusinessDomain.findUnique({
      where: { id },
      include: DOMAIN_INCLUDE,
    });
    if (!row) throw new NotFoundException('Domain not found');
    return row;
  }

  async create(dto: CreateDomainDto, createdBySystemUserId?: string) {
    const hostname = normalizeHost(dto.hostname);
    if (!hostname) {
      throw new BadRequestException(
        'Enter a hostname such as app.example.com - no scheme, port or path',
      );
    }

    // A bare label cannot be a public domain, and allowing one would let an
    // operator claim something like "localhost" by another spelling.
    if (!hostname.includes('.')) {
      throw new BadRequestException('Enter a full hostname, such as app.example.com');
    }

    // Without this an admin can point the console's own hostname at a tenant
    // portal and lock themselves out of the system console entirely.
    if (this.site.isReservedHost(hostname)) {
      throw new BadRequestException(
        `"${hostname}" is reserved for the system console and cannot be a business domain`,
      );
    }

    const business = await this.prisma.tenantBusiness.findFirst({
      where: { id: dto.tenantBusinessId, deletedAt: null },
      select: { id: true },
    });
    if (!business) throw new BadRequestException('Business does not exist');

    const clash = await this.prisma.tenantBusinessDomain.findUnique({ where: { hostname } });
    if (clash) throw new ConflictException('This hostname is already used by a business');

    const timestamp = now();
    const created = await this.prisma.tenantBusinessDomain.create({
      data: {
        id: newId(),
        tenantBusinessId: dto.tenantBusinessId,
        hostname,
        enabled: dto.enabled,
        createdBySystemUserId: createdBySystemUserId ?? null,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      include: DOMAIN_INCLUDE,
    });

    // So the edge can get a certificate for it on the very next visit rather
    // than after the cache window.
    this.site.invalidate();
    return created;
  }

  async update(id: string, dto: UpdateDomainDto) {
    await this.findOne(id);
    const updated = await this.prisma.tenantBusinessDomain.update({
      where: { id },
      data: { ...dto, updatedAt: now() },
      include: DOMAIN_INCLUDE,
    });
    this.site.invalidate();
    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);
    // Hard delete, on purpose - see the class docblock.
    await this.prisma.tenantBusinessDomain.delete({ where: { id } });
    this.site.invalidate();
    return { success: true };
  }
}
