import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { newId, newSystemCode, now } from '../common/utils/id.util';
import { listResponse, paginate } from '../common/dto/query.dto';
import { CreateTenantDistrictDto, UpdateTenantDistrictDto } from './dto/tenant-district.dto';
import { TenantDistrictListQueryDto } from './dto/tenant-district-query.dto';

const INCLUDE = {
  tenantBusiness: { select: { id: true, systemCode: true, name: true } },
  state: { select: { id: true, stateName: true } },
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
      { districtName: { contains: search, mode: 'insensitive' as const } },
      { districtNameTamil: { contains: search, mode: 'insensitive' as const } },
      { districtCode: { contains: search, mode: 'insensitive' as const } },
      { systemCode: { contains: search, mode: 'insensitive' as const } },
    ],
  };
}

@Injectable()
export class TenantDistrictsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: TenantDistrictListQueryDto) {
    const { page, limit, search, status, tenantBusinessId, stateId, sortBy, sortOrder } = query;
    const where = {
      status: status ? status : ({ not: 'DELETED' } as const),
      ...(tenantBusinessId ? { tenantBusinessId } : {}),
      ...(stateId ? { stateId } : {}),
      ...searchClause(search),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.tenantDistrict.findMany({
        where,
        include: INCLUDE,
        orderBy: { [sortBy]: sortOrder },
        ...paginate(page, limit),
      }),
      this.prisma.tenantDistrict.count({ where }),
    ]);
    return listResponse(items, total, page, limit);
  }

  async findOne(id: string) {
    const row = await this.prisma.tenantDistrict.findFirst({
      where: { id, status: { not: 'DELETED' } },
      include: INCLUDE,
    });
    if (!row) throw new NotFoundException('District not found');
    return row;
  }

  async create(dto: CreateTenantDistrictDto) {
    await this.assertBusinessExists(dto.tenantBusinessId);
    await this.assertChain(dto.tenantBusinessId, dto.stateId);
    await this.assertDistrictCodeUnique(dto.tenantBusinessId, dto.districtCode);

    const timestamp = now();
    return this.prisma.tenantDistrict.create({
      data: {
        id: newId(),
        systemCode: newSystemCode('DIS'),
        tenantBusinessId: dto.tenantBusinessId,
        stateId: dto.stateId,
        districtName: dto.districtName,
        districtNameTamil: dto.districtNameTamil,
        districtCode: dto.districtCode,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      include: INCLUDE,
    });
  }

  async update(id: string, dto: UpdateTenantDistrictDto) {
    const row = await this.prisma.tenantDistrict.findFirst({
      where: { id, status: { not: 'DELETED' } },
    });
    if (!row) throw new NotFoundException('District not found');
    if (dto.tenantBusinessId) await this.assertBusinessExists(dto.tenantBusinessId);
    if (dto.stateId || dto.tenantBusinessId) {
      await this.assertChain(dto.tenantBusinessId ?? row.tenantBusinessId, dto.stateId ?? row.stateId);
    }
    // Re-assert when EITHER half of the key changes, falling back to the
    // stored value for the other half.
    if (dto.districtCode || dto.tenantBusinessId) {
      await this.assertDistrictCodeUnique(
        dto.tenantBusinessId ?? row.tenantBusinessId,
        dto.districtCode ?? row.districtCode,
        id,
      );
    }

    return this.prisma.tenantDistrict.update({
      where: { id },
      data: { ...dto, updatedAt: now() },
      include: INCLUDE,
    });
  }

  async remove(id: string) {
    const row = await this.prisma.tenantDistrict.findFirst({
      where: { id, status: { not: 'DELETED' } },
    });
    if (!row) throw new NotFoundException('District not found');

    const timestamp = now();
    await this.prisma.tenantDistrict.update({
      where: { id },
      data: { status: 'DELETED', deletedAt: timestamp, updatedAt: timestamp },
    });
    return { success: true };
  }

  async restore(id: string) {
    const row = await this.prisma.tenantDistrict.findFirst({
      where: { id, status: 'DELETED' },
    });
    if (!row) throw new NotFoundException('District not found or not deleted');
    return this.prisma.tenantDistrict.update({
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
   * Walks the parent chain. The database cannot express "this district belongs
   * to that state", so without this the two ids drift apart silently.
   */
  private async assertChain(tenantBusinessId: string, stateId: string) {
    const state = await this.prisma.tenantState.findFirst({
      where: { id: stateId, tenantBusinessId, status: { not: 'DELETED' } },
    });
    if (!state) {
      throw new BadRequestException(
        'State does not exist for the given tenant business',
      );
    }
  }

  /**
   * Deliberately NOT scoped to status != DELETED: the
   * (tenantBusinessId, districtCode) unique index applies to every row whatever its
   * soft-delete state, so a code held by a deleted-but-restorable row cannot
   * be reissued either.
   *
   * BadRequestException rather than Conflict, matching tenant-streets - the
   * message reaches the user verbatim through the console toast.
   */
  private async assertDistrictCodeUnique(
    tenantBusinessId: string,
    districtCode: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.tenantDistrict.findFirst({
      where: {
        tenantBusinessId,
        districtCode,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    if (existing) {
      throw new BadRequestException(
        `District code "${districtCode}" is already used for this business`,
      );
    }
  }

  /** Options for the state picker. A bare array, no listResponse envelope. */
  async listStates(tenantBusinessId: string) {
    if (!tenantBusinessId) return [];
    return this.prisma.tenantState.findMany({
      where: {
        tenantBusinessId,
        status: { not: 'DELETED' },
      },
      select: { id: true, stateName: true },
      orderBy: { stateName: 'asc' },
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

  async listStatesForTenantUser(tenantUserId: string, tenantBusinessId: string) {
    await this.assertBusinessOwned(tenantUserId, tenantBusinessId);
    return this.listStates(tenantBusinessId);
  }

  async findAllForTenantUser(tenantUserId: string, query: TenantDistrictListQueryDto) {
    const businessIds = await this.getMappedBusinessIds(tenantUserId);
    const { page, limit, search, status, tenantBusinessId, stateId, sortBy, sortOrder } = query;
    // A requested business is intersected with the caller's own, never trusted.
    const scopedBusinessIds = tenantBusinessId
      ? businessIds.filter((bid) => bid === tenantBusinessId)
      : businessIds;
    const where = {
      tenantBusinessId: { in: scopedBusinessIds },
      status: status ? status : ({ not: 'DELETED' } as const),
      ...(stateId ? { stateId } : {}),
      ...searchClause(search),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.tenantDistrict.findMany({
        where,
        include: INCLUDE,
        orderBy: { [sortBy]: sortOrder },
        ...paginate(page, limit),
      }),
      this.prisma.tenantDistrict.count({ where }),
    ]);
    return listResponse(items, total, page, limit);
  }

  async findOneForTenantUser(tenantUserId: string, id: string) {
    const businessIds = await this.getMappedBusinessIds(tenantUserId);
    const row = await this.prisma.tenantDistrict.findFirst({
      where: { id, tenantBusinessId: { in: businessIds }, status: { not: 'DELETED' } },
      include: INCLUDE,
    });
    if (!row) throw new NotFoundException('District not found');
    return row;
  }

  async createForTenantUser(tenantUserId: string, dto: CreateTenantDistrictDto) {
    await this.assertBusinessOwned(tenantUserId, dto.tenantBusinessId);
    return this.create(dto);
  }

  async updateForTenantUser(tenantUserId: string, id: string, dto: UpdateTenantDistrictDto) {
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
