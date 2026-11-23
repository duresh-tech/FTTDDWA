import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { newId, newSystemCode, now } from '../common/utils/id.util';
import { listResponse, paginate } from '../common/dto/query.dto';
import { CreateTenantRtoDto, UpdateTenantRtoDto } from './dto/tenant-rto.dto';
import { TenantRtoListQueryDto } from './dto/tenant-rto-query.dto';

const INCLUDE = {
  tenantBusiness: { select: { id: true, systemCode: true, name: true } },
  district: { select: { id: true, districtName: true, districtNameTamil: true } },
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
  const contains = { contains: search, mode: 'insensitive' as const };
  return {
    OR: [
      { rtoName: contains },
      { rtoNameTamil: contains },
      { rtoCode: contains },
      { systemCode: contains },
    ],
  };
}

@Injectable()
export class TenantRtosService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: TenantRtoListQueryDto) {
    const { page, limit, search, status, tenantBusinessId, tenantDistrictId, sortBy, sortOrder } =
      query;
    const where = {
      status: status ? status : ({ not: 'DELETED' } as const),
      ...(tenantBusinessId ? { tenantBusinessId } : {}),
      ...(tenantDistrictId ? { tenantDistrictId } : {}),
      ...searchClause(search),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.tenantRto.findMany({
        where,
        include: INCLUDE,
        orderBy: { [sortBy]: sortOrder },
        ...paginate(page, limit),
      }),
      this.prisma.tenantRto.count({ where }),
    ]);
    return listResponse(items, total, page, limit);
  }

  async findOne(id: string) {
    const row = await this.prisma.tenantRto.findFirst({
      where: { id, status: { not: 'DELETED' } },
      include: INCLUDE,
    });
    if (!row) throw new NotFoundException('RTO not found');
    return row;
  }

  async create(dto: CreateTenantRtoDto) {
    await this.assertBusinessExists(dto.tenantBusinessId);
    await this.assertDistrictOwned(dto.tenantBusinessId, dto.tenantDistrictId);
    await this.assertCodeUnique(dto.tenantBusinessId, dto.rtoCode);

    const timestamp = now();
    return this.prisma.tenantRto.create({
      data: {
        id: newId(),
        systemCode: newSystemCode('RTO'),
        tenantBusinessId: dto.tenantBusinessId,
        tenantDistrictId: dto.tenantDistrictId,
        rtoName: dto.rtoName,
        rtoNameTamil: dto.rtoNameTamil,
        rtoCode: dto.rtoCode,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      include: INCLUDE,
    });
  }

  async update(id: string, dto: UpdateTenantRtoDto) {
    const row = await this.prisma.tenantRto.findFirst({
      where: { id, status: { not: 'DELETED' } },
    });
    if (!row) throw new NotFoundException('RTO not found');

    const tenantBusinessId = dto.tenantBusinessId ?? row.tenantBusinessId;
    if (dto.tenantBusinessId) await this.assertBusinessExists(dto.tenantBusinessId);
    if (dto.tenantDistrictId || dto.tenantBusinessId) {
      await this.assertDistrictOwned(
        tenantBusinessId,
        dto.tenantDistrictId ?? row.tenantDistrictId,
      );
    }
    // Re-asserted when EITHER half of the key changes, not just the code.
    if (dto.rtoCode || dto.tenantBusinessId) {
      await this.assertCodeUnique(tenantBusinessId, dto.rtoCode ?? row.rtoCode, id);
    }

    return this.prisma.tenantRto.update({
      where: { id },
      data: { ...dto, updatedAt: now() },
      include: INCLUDE,
    });
  }

  async remove(id: string) {
    const row = await this.prisma.tenantRto.findFirst({
      where: { id, status: { not: 'DELETED' } },
    });
    if (!row) throw new NotFoundException('RTO not found');

    const timestamp = now();
    await this.prisma.tenantRto.update({
      where: { id },
      data: { status: 'DELETED', deletedAt: timestamp, updatedAt: timestamp },
    });
    return { success: true };
  }

  async restore(id: string) {
    const row = await this.prisma.tenantRto.findFirst({
      where: { id, status: 'DELETED' },
    });
    if (!row) throw new NotFoundException('RTO not found or not deleted');
    return this.prisma.tenantRto.update({
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
   * The district must belong to the same business. The database cannot express
   * that, so without this an RTO can be filed under another tenant's district.
   */
  private async assertDistrictOwned(tenantBusinessId: string, tenantDistrictId: string) {
    const district = await this.prisma.tenantDistrict.findFirst({
      where: { id: tenantDistrictId, tenantBusinessId, status: { not: 'DELETED' } },
    });
    if (!district) {
      throw new BadRequestException(
        'District does not exist for the given tenant business',
      );
    }
  }

  /**
   * One RTO code per business.
   *
   * Two choices here look like bugs and are not, both copied from
   * `assertStreetCodeUnique`: it throws BadRequest (400) rather than Conflict,
   * and it deliberately does NOT exclude soft-deleted rows - a code held by a
   * restorable RTO must not be reissued, or restoring it would collide.
   */
  private async assertCodeUnique(
    tenantBusinessId: string,
    rtoCode: string,
    exceptId?: string,
  ) {
    const clash = await this.prisma.tenantRto.findFirst({
      where: {
        tenantBusinessId,
        rtoCode: { equals: rtoCode, mode: 'insensitive' },
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
    });
    if (clash) {
      throw new BadRequestException(
        `RTO code "${rtoCode}" is already used by this business`,
      );
    }
  }

  /** Options for the district picker. A bare array, no listResponse envelope. */
  async listDistricts(tenantBusinessId: string) {
    if (!tenantBusinessId) return [];
    return this.prisma.tenantDistrict.findMany({
      where: { tenantBusinessId, status: { not: 'DELETED' } },
      select: { id: true, districtName: true },
      orderBy: { districtName: 'asc' },
    });
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

  async listDistrictsForTenantUser(tenantUserId: string, tenantBusinessId: string) {
    await this.assertBusinessOwned(tenantUserId, tenantBusinessId);
    return this.listDistricts(tenantBusinessId);
  }

  async findAllForTenantUser(tenantUserId: string, query: TenantRtoListQueryDto) {
    const businessIds = await this.getMappedBusinessIds(tenantUserId);
    const { page, limit, search, status, tenantBusinessId, tenantDistrictId, sortBy, sortOrder } =
      query;
    // A requested business is intersected with the caller's own, never trusted.
    const scopedBusinessIds = tenantBusinessId
      ? businessIds.filter((bid) => bid === tenantBusinessId)
      : businessIds;
    const where = {
      tenantBusinessId: { in: scopedBusinessIds },
      status: status ? status : ({ not: 'DELETED' } as const),
      ...(tenantDistrictId ? { tenantDistrictId } : {}),
      ...searchClause(search),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.tenantRto.findMany({
        where,
        include: INCLUDE,
        orderBy: { [sortBy]: sortOrder },
        ...paginate(page, limit),
      }),
      this.prisma.tenantRto.count({ where }),
    ]);
    return listResponse(items, total, page, limit);
  }

  async findOneForTenantUser(tenantUserId: string, id: string) {
    const businessIds = await this.getMappedBusinessIds(tenantUserId);
    const row = await this.prisma.tenantRto.findFirst({
      where: { id, tenantBusinessId: { in: businessIds }, status: { not: 'DELETED' } },
      include: INCLUDE,
    });
    if (!row) throw new NotFoundException('RTO not found');
    return row;
  }

  async createForTenantUser(tenantUserId: string, dto: CreateTenantRtoDto) {
    await this.assertBusinessOwned(tenantUserId, dto.tenantBusinessId);
    return this.create(dto);
  }

  async updateForTenantUser(tenantUserId: string, id: string, dto: UpdateTenantRtoDto) {
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
