import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { newId, newSystemCode, now } from '../common/utils/id.util';
import { listResponse, paginate } from '../common/dto/query.dto';
import { CreateTenantCountryDto, UpdateTenantCountryDto } from './dto/tenant-country.dto';
import { TenantCountryListQueryDto } from './dto/tenant-country-query.dto';

const INCLUDE = {
  tenantBusiness: { select: { id: true, systemCode: true, name: true } },
};

/**
 * Shared by the system and tenant list methods so the two surfaces cannot
 * drift into matching different columns.
 *
 * `mode: 'insensitive' as const` is required, not stylistic: Postgres compares
 * text case-sensitively, and without `as const` the property widens to
 * `string` and Prisma's types reject it. Tamil has no case, so there it is
 * simply a substring match.
 */
function searchClause(search?: string) {
  if (!search) return {};
  return {
    OR: [
      { countryName: { contains: search, mode: 'insensitive' as const } },
      { countryNameTamil: { contains: search, mode: 'insensitive' as const } },
      { countryCode: { contains: search, mode: 'insensitive' as const } },
      { systemCode: { contains: search, mode: 'insensitive' as const } },
    ],
  };
}

@Injectable()
export class TenantCountriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: TenantCountryListQueryDto) {
    const { page, limit, search, status, tenantBusinessId, sortBy, sortOrder } = query;
    const where = {
      status: status ? status : ({ not: 'DELETED' } as const),
      ...(tenantBusinessId ? { tenantBusinessId } : {}),
      ...searchClause(search),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.tenantCountry.findMany({
        where,
        include: INCLUDE,
        orderBy: { [sortBy]: sortOrder },
        ...paginate(page, limit),
      }),
      this.prisma.tenantCountry.count({ where }),
    ]);
    return listResponse(items, total, page, limit);
  }

  async findOne(id: string) {
    const row = await this.prisma.tenantCountry.findFirst({
      where: { id, status: { not: 'DELETED' } },
      include: INCLUDE,
    });
    if (!row) throw new NotFoundException('Country not found');
    return row;
  }

  async create(dto: CreateTenantCountryDto) {
    await this.assertBusinessExists(dto.tenantBusinessId);
    await this.assertCountryCodeUnique(dto.tenantBusinessId, dto.countryCode);

    const timestamp = now();
    return this.prisma.tenantCountry.create({
      data: {
        id: newId(),
        systemCode: newSystemCode('CTR'),
        tenantBusinessId: dto.tenantBusinessId,
        countryName: dto.countryName,
        countryNameTamil: dto.countryNameTamil,
        countryCode: dto.countryCode,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      include: INCLUDE,
    });
  }

  async update(id: string, dto: UpdateTenantCountryDto) {
    const row = await this.prisma.tenantCountry.findFirst({
      where: { id, status: { not: 'DELETED' } },
    });
    if (!row) throw new NotFoundException('Country not found');
    if (dto.tenantBusinessId) await this.assertBusinessExists(dto.tenantBusinessId);
    // Re-assert when EITHER half of the key changes, falling back to the
    // stored value for the other half.
    if (dto.countryCode || dto.tenantBusinessId) {
      await this.assertCountryCodeUnique(
        dto.tenantBusinessId ?? row.tenantBusinessId,
        dto.countryCode ?? row.countryCode,
        id,
      );
    }

    return this.prisma.tenantCountry.update({
      where: { id },
      data: { ...dto, updatedAt: now() },
      include: INCLUDE,
    });
  }

  async remove(id: string) {
    const row = await this.prisma.tenantCountry.findFirst({
      where: { id, status: { not: 'DELETED' } },
    });
    if (!row) throw new NotFoundException('Country not found');
    // A soft-deleted country's row survives, so the FK alone would not stop a
    // state from being pointed at a country the UI no longer shows.
    const usedByStates = await this.prisma.tenantState.count({
      where: { countryId: id, status: { not: 'DELETED' } },
    });
    if (usedByStates > 0) {
      throw new BadRequestException('Country is still used by states');
    }

    const timestamp = now();
    await this.prisma.tenantCountry.update({
      where: { id },
      data: { status: 'DELETED', deletedAt: timestamp, updatedAt: timestamp },
    });
    return { success: true };
  }

  async restore(id: string) {
    const row = await this.prisma.tenantCountry.findFirst({
      where: { id, status: 'DELETED' },
    });
    if (!row) throw new NotFoundException('Country not found or not deleted');
    return this.prisma.tenantCountry.update({
      where: { id },
      data: { status: 'ACTIVE', deletedAt: null, updatedAt: now() },
      include: INCLUDE,
    });
  }

  private async assertBusinessExists(tenantBusinessId: string) {
    const business = await this.prisma.tenantBusiness.findFirst({
      where: { id: tenantBusinessId, status: { not: 'DELETED' } },
    });
    if (!business) {
      throw new BadRequestException('Tenant business does not exist or is deleted');
    }
  }

  /**
   * Deliberately NOT scoped to status != DELETED: the
   * (tenantBusinessId, countryCode) unique index applies to every row whatever
   * its soft-delete state, so a code held by a deleted-but-restorable row cannot
   * be reissued either.
   *
   * BadRequestException rather than Conflict, matching tenant-states - the
   * message reaches the user verbatim through the console toast.
   */
  private async assertCountryCodeUnique(
    tenantBusinessId: string,
    countryCode: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.tenantCountry.findFirst({
      where: {
        tenantBusinessId,
        countryCode,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    if (existing) {
      throw new BadRequestException(
        `Country code "${countryCode}" is already used for this business`,
      );
    }
  }

  // ---------- Tenant self-service (scoped to the caller's mapped businesses) ----------

  async listMappedBusinesses(tenantUserId: string) {
    const businessIds = await this.getMappedBusinessIds(tenantUserId);
    return this.prisma.tenantBusiness.findMany({
      where: { id: { in: businessIds }, status: { not: 'DELETED' } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  async findAllForTenantUser(tenantUserId: string, query: TenantCountryListQueryDto) {
    const businessIds = await this.getMappedBusinessIds(tenantUserId);
    const { page, limit, search, status, tenantBusinessId, sortBy, sortOrder } = query;
    // A requested business is intersected with the caller's own, never trusted.
    const scopedBusinessIds = tenantBusinessId
      ? businessIds.filter((bid) => bid === tenantBusinessId)
      : businessIds;
    const where = {
      tenantBusinessId: { in: scopedBusinessIds },
      status: status ? status : ({ not: 'DELETED' } as const),
      ...searchClause(search),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.tenantCountry.findMany({
        where,
        include: INCLUDE,
        orderBy: { [sortBy]: sortOrder },
        ...paginate(page, limit),
      }),
      this.prisma.tenantCountry.count({ where }),
    ]);
    return listResponse(items, total, page, limit);
  }

  async findOneForTenantUser(tenantUserId: string, id: string) {
    const businessIds = await this.getMappedBusinessIds(tenantUserId);
    const row = await this.prisma.tenantCountry.findFirst({
      where: { id, tenantBusinessId: { in: businessIds }, status: { not: 'DELETED' } },
      include: INCLUDE,
    });
    if (!row) throw new NotFoundException('Country not found');
    return row;
  }

  async createForTenantUser(tenantUserId: string, dto: CreateTenantCountryDto) {
    await this.assertBusinessOwned(tenantUserId, dto.tenantBusinessId);
    return this.create(dto);
  }

  async updateForTenantUser(tenantUserId: string, id: string, dto: UpdateTenantCountryDto) {
    await this.findOneForTenantUser(tenantUserId, id);
    if (dto.tenantBusinessId) await this.assertBusinessOwned(tenantUserId, dto.tenantBusinessId);
    return this.update(id, dto);
  }

  async removeForTenantUser(tenantUserId: string, id: string) {
    await this.findOneForTenantUser(tenantUserId, id);
    return this.remove(id);
  }

  private async getMappedBusinessIds(tenantUserId: string): Promise<string[]> {
    const mappings = await this.prisma.tenantMappedBusiness.findMany({
      where: { tenantUserId, status: 'ACTIVE' },
      select: { tenantBusinessId: true },
    });
    return mappings.map((m) => m.tenantBusinessId);
  }

  private async assertBusinessOwned(tenantUserId: string, tenantBusinessId: string) {
    const businessIds = await this.getMappedBusinessIds(tenantUserId);
    if (!businessIds.includes(tenantBusinessId)) {
      throw new ForbiddenException('You are not mapped to this business');
    }
  }
}
