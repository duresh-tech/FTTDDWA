import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { newId, newSystemCode, now } from '../common/utils/id.util';
import { listResponse, paginate } from '../common/dto/query.dto';
import { CreateTenantStateDto, UpdateTenantStateDto } from './dto/tenant-state.dto';
import { TenantStateListQueryDto } from './dto/tenant-state-query.dto';

const INCLUDE = {
  tenantBusiness: { select: { id: true, systemCode: true, name: true } },
  country: { select: { id: true, countryName: true, countryCode: true, status: true } },
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
      { stateName: { contains: search, mode: 'insensitive' as const } },
      { stateNameTamil: { contains: search, mode: 'insensitive' as const } },
      { stateCode: { contains: search, mode: 'insensitive' as const } },
      { country: { countryName: { contains: search, mode: 'insensitive' as const } } },
      { systemCode: { contains: search, mode: 'insensitive' as const } },
    ],
  };
}

@Injectable()
export class TenantStatesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: TenantStateListQueryDto) {
    const { page, limit, search, status, tenantBusinessId, sortBy, sortOrder } = query;
    const where = {
      status: status ? status : ({ not: 'DELETED' } as const),
      ...(tenantBusinessId ? { tenantBusinessId } : {}),
      ...searchClause(search),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.tenantState.findMany({
        where,
        include: INCLUDE,
        orderBy: { [sortBy]: sortOrder },
        ...paginate(page, limit),
      }),
      this.prisma.tenantState.count({ where }),
    ]);
    return listResponse(items, total, page, limit);
  }

  async findOne(id: string) {
    const row = await this.prisma.tenantState.findFirst({
      where: { id, status: { not: 'DELETED' } },
      include: INCLUDE,
    });
    if (!row) throw new NotFoundException('State not found');
    return row;
  }

  async create(dto: CreateTenantStateDto) {
    await this.assertBusinessExists(dto.tenantBusinessId);
    await this.assertCountryExists(dto.countryId, dto.tenantBusinessId);
    await this.assertStateCodeUnique(dto.tenantBusinessId, dto.stateCode);

    const timestamp = now();
    return this.prisma.tenantState.create({
      data: {
        id: newId(),
        systemCode: newSystemCode('STA'),
        tenantBusinessId: dto.tenantBusinessId,
        stateName: dto.stateName,
        stateNameTamil: dto.stateNameTamil,
        stateCode: dto.stateCode,
        countryId: dto.countryId,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      include: INCLUDE,
    });
  }

  async update(id: string, dto: UpdateTenantStateDto) {
    const row = await this.prisma.tenantState.findFirst({
      where: { id, status: { not: 'DELETED' } },
    });
    if (!row) throw new NotFoundException('State not found');
    if (dto.tenantBusinessId) await this.assertBusinessExists(dto.tenantBusinessId);
    // The country must stay in the same business as the state, so re-check it
    // when either the country or the business changes.
    if (dto.countryId || dto.tenantBusinessId) {
      await this.assertCountryExists(
        dto.countryId ?? row.countryId,
        dto.tenantBusinessId ?? row.tenantBusinessId,
      );
    }
    // Re-assert when EITHER half of the key changes, falling back to the
    // stored value for the other half.
    if (dto.stateCode || dto.tenantBusinessId) {
      await this.assertStateCodeUnique(
        dto.tenantBusinessId ?? row.tenantBusinessId,
        dto.stateCode ?? row.stateCode,
        id,
      );
    }

    return this.prisma.tenantState.update({
      where: { id },
      data: { ...dto, updatedAt: now() },
      include: INCLUDE,
    });
  }

  async remove(id: string) {
    const row = await this.prisma.tenantState.findFirst({
      where: { id, status: { not: 'DELETED' } },
    });
    if (!row) throw new NotFoundException('State not found');

    const timestamp = now();
    await this.prisma.tenantState.update({
      where: { id },
      data: { status: 'DELETED', deletedAt: timestamp, updatedAt: timestamp },
    });
    return { success: true };
  }

  async restore(id: string) {
    const row = await this.prisma.tenantState.findFirst({
      where: { id, status: 'DELETED' },
    });
    if (!row) throw new NotFoundException('State not found or not deleted');
    return this.prisma.tenantState.update({
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
   * A state may only point at an active country of its own business. Without
   * the business check a caller could attach a state to another tenant's
   * country by guessing its id.
   */
  private async assertCountryExists(countryId: string, tenantBusinessId: string) {
    const country = await this.prisma.tenantCountry.findFirst({
      where: { id: countryId, tenantBusinessId, status: 'ACTIVE' },
    });
    if (!country) {
      throw new BadRequestException('Country does not exist, is deleted, or belongs to another business');
    }
  }

  /**
   * Deliberately NOT scoped to status != DELETED: the
   * (tenantBusinessId, stateCode) unique index applies to every row whatever its
   * soft-delete state, so a code held by a deleted-but-restorable row cannot
   * be reissued either.
   *
   * BadRequestException rather than Conflict, matching tenant-streets - the
   * message reaches the user verbatim through the console toast.
   */
  private async assertStateCodeUnique(
    tenantBusinessId: string,
    stateCode: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.tenantState.findFirst({
      where: {
        tenantBusinessId,
        stateCode,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    if (existing) {
      throw new BadRequestException(
        `State code "${stateCode}" is already used for this business`,
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

  async findAllForTenantUser(tenantUserId: string, query: TenantStateListQueryDto) {
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
      this.prisma.tenantState.findMany({
        where,
        include: INCLUDE,
        orderBy: { [sortBy]: sortOrder },
        ...paginate(page, limit),
      }),
      this.prisma.tenantState.count({ where }),
    ]);
    return listResponse(items, total, page, limit);
  }

  async findOneForTenantUser(tenantUserId: string, id: string) {
    const businessIds = await this.getMappedBusinessIds(tenantUserId);
    const row = await this.prisma.tenantState.findFirst({
      where: { id, tenantBusinessId: { in: businessIds }, status: { not: 'DELETED' } },
      include: INCLUDE,
    });
    if (!row) throw new NotFoundException('State not found');
    return row;
  }

  async createForTenantUser(tenantUserId: string, dto: CreateTenantStateDto) {
    await this.assertBusinessOwned(tenantUserId, dto.tenantBusinessId);
    return this.create(dto);
  }

  async updateForTenantUser(tenantUserId: string, id: string, dto: UpdateTenantStateDto) {
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
