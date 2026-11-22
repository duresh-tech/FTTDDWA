import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { newId, newSystemCode, now } from '../common/utils/id.util';
import { listResponse, paginate } from '../common/dto/query.dto';
import { CreateTenantTalukDto, UpdateTenantTalukDto } from './dto/tenant-taluk.dto';
import { TenantTalukListQueryDto } from './dto/tenant-taluk-query.dto';

const INCLUDE = {
  tenantBusiness: { select: { id: true, systemCode: true, name: true } },
  state: { select: { id: true, stateName: true } },
  district: { select: { id: true, districtName: true } },
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
      { talukName: { contains: search, mode: 'insensitive' as const } },
      { talukNameTamil: { contains: search, mode: 'insensitive' as const } },
      { systemCode: { contains: search, mode: 'insensitive' as const } },
    ],
  };
}

@Injectable()
export class TenantTaluksService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: TenantTalukListQueryDto) {
    const { page, limit, search, status, tenantBusinessId, stateId, districtId, sortBy, sortOrder } = query;
    const where = {
      status: status ? status : ({ not: 'DELETED' } as const),
      ...(tenantBusinessId ? { tenantBusinessId } : {}),
      ...(stateId ? { stateId } : {}),
      ...(districtId ? { districtId } : {}),
      ...searchClause(search),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.tenantTaluk.findMany({
        where,
        include: INCLUDE,
        orderBy: { [sortBy]: sortOrder },
        ...paginate(page, limit),
      }),
      this.prisma.tenantTaluk.count({ where }),
    ]);
    return listResponse(items, total, page, limit);
  }

  async findOne(id: string) {
    const row = await this.prisma.tenantTaluk.findFirst({
      where: { id, status: { not: 'DELETED' } },
      include: INCLUDE,
    });
    if (!row) throw new NotFoundException('Taluk not found');
    return row;
  }

  async create(dto: CreateTenantTalukDto) {
    await this.assertBusinessExists(dto.tenantBusinessId);
    await this.assertChain(dto.tenantBusinessId, dto.stateId, dto.districtId);

    const timestamp = now();
    return this.prisma.tenantTaluk.create({
      data: {
        id: newId(),
        systemCode: newSystemCode('TLK'),
        tenantBusinessId: dto.tenantBusinessId,
        stateId: dto.stateId,
        districtId: dto.districtId,
        talukName: dto.talukName,
        talukNameTamil: dto.talukNameTamil,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      include: INCLUDE,
    });
  }

  async update(id: string, dto: UpdateTenantTalukDto) {
    const row = await this.prisma.tenantTaluk.findFirst({
      where: { id, status: { not: 'DELETED' } },
    });
    if (!row) throw new NotFoundException('Taluk not found');
    if (dto.tenantBusinessId) await this.assertBusinessExists(dto.tenantBusinessId);
    if (dto.stateId || dto.districtId || dto.tenantBusinessId) {
      await this.assertChain(dto.tenantBusinessId ?? row.tenantBusinessId, dto.stateId ?? row.stateId, dto.districtId ?? row.districtId);
    }

    return this.prisma.tenantTaluk.update({
      where: { id },
      data: { ...dto, updatedAt: now() },
      include: INCLUDE,
    });
  }

  async remove(id: string) {
    const row = await this.prisma.tenantTaluk.findFirst({
      where: { id, status: { not: 'DELETED' } },
    });
    if (!row) throw new NotFoundException('Taluk not found');

    const timestamp = now();
    await this.prisma.tenantTaluk.update({
      where: { id },
      data: { status: 'DELETED', deletedAt: timestamp, updatedAt: timestamp },
    });
    return { success: true };
  }

  async restore(id: string) {
    const row = await this.prisma.tenantTaluk.findFirst({
      where: { id, status: 'DELETED' },
    });
    if (!row) throw new NotFoundException('Taluk not found or not deleted');
    return this.prisma.tenantTaluk.update({
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
  private async assertChain(tenantBusinessId: string, stateId: string, districtId: string) {
    const state = await this.prisma.tenantState.findFirst({
      where: { id: stateId, tenantBusinessId, status: { not: 'DELETED' } },
    });
    if (!state) {
      throw new BadRequestException(
        'State does not exist for the given tenant business',
      );
    }

    const district = await this.prisma.tenantDistrict.findFirst({
      where: { id: districtId, tenantBusinessId, stateId: stateId, status: { not: 'DELETED' } },
    });
    if (!district) {
      throw new BadRequestException(
        'District does not exist for the given tenant business, or does not belong to the chosen state',
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

  /** Options for the district picker. A bare array, no listResponse envelope. */
  async listDistricts(tenantBusinessId: string, stateId?: string) {
    if (!tenantBusinessId) return [];
    return this.prisma.tenantDistrict.findMany({
      where: {
        tenantBusinessId,
        status: { not: 'DELETED' },
        ...(stateId ? { stateId } : {}),
      },
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

  async listStatesForTenantUser(tenantUserId: string, tenantBusinessId: string) {
    await this.assertBusinessOwned(tenantUserId, tenantBusinessId);
    return this.listStates(tenantBusinessId);
  }

  async listDistrictsForTenantUser(tenantUserId: string, tenantBusinessId: string, stateId?: string) {
    await this.assertBusinessOwned(tenantUserId, tenantBusinessId);
    return this.listDistricts(tenantBusinessId, stateId);
  }

  async findAllForTenantUser(tenantUserId: string, query: TenantTalukListQueryDto) {
    const businessIds = await this.getMappedBusinessIds(tenantUserId);
    const { page, limit, search, status, tenantBusinessId, stateId, districtId, sortBy, sortOrder } = query;
    // A requested business is intersected with the caller's own, never trusted.
    const scopedBusinessIds = tenantBusinessId
      ? businessIds.filter((bid) => bid === tenantBusinessId)
      : businessIds;
    const where = {
      tenantBusinessId: { in: scopedBusinessIds },
      status: status ? status : ({ not: 'DELETED' } as const),
      ...(stateId ? { stateId } : {}),
      ...(districtId ? { districtId } : {}),
      ...searchClause(search),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.tenantTaluk.findMany({
        where,
        include: INCLUDE,
        orderBy: { [sortBy]: sortOrder },
        ...paginate(page, limit),
      }),
      this.prisma.tenantTaluk.count({ where }),
    ]);
    return listResponse(items, total, page, limit);
  }

  async findOneForTenantUser(tenantUserId: string, id: string) {
    const businessIds = await this.getMappedBusinessIds(tenantUserId);
    const row = await this.prisma.tenantTaluk.findFirst({
      where: { id, tenantBusinessId: { in: businessIds }, status: { not: 'DELETED' } },
      include: INCLUDE,
    });
    if (!row) throw new NotFoundException('Taluk not found');
    return row;
  }

  async createForTenantUser(tenantUserId: string, dto: CreateTenantTalukDto) {
    await this.assertBusinessOwned(tenantUserId, dto.tenantBusinessId);
    return this.create(dto);
  }

  async updateForTenantUser(tenantUserId: string, id: string, dto: UpdateTenantTalukDto) {
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
