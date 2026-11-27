import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { newId, newSystemCode, now } from '../common/utils/id.util';
import { listResponse, paginate } from '../common/dto/query.dto';
import {
  CreateTenantAssociationPositionDto,
  UpdateTenantAssociationPositionDto,
} from './dto/tenant-association-position.dto';
import { TenantAssociationPositionListQueryDto } from './dto/tenant-association-position-query.dto';

const POSITION_INCLUDE = {
  tenantBusiness: { select: { id: true, systemCode: true, name: true } },
};

/**
 * The search clause, shared by the system and tenant list methods so the two
 * surfaces cannot drift into matching different columns.
 *
 * `mode: 'insensitive' as const` is required, not stylistic: Postgres compares
 * text case-sensitively, and without `as const` the `mode` property widens to
 * `string` in a standalone object and Prisma's types reject it.
 *
 * Tamil has no upper/lower case, so `insensitive` is simply a substring match
 * there - it costs nothing and keeps one idiom across both names.
 */
function searchClause(search?: string) {
  if (!search) return {};
  return {
    OR: [
      { positionName: { contains: search, mode: 'insensitive' as const } },
      { positionNameTamil: { contains: search, mode: 'insensitive' as const } },
      { systemCode: { contains: search, mode: 'insensitive' as const } },
    ],
  };
}

@Injectable()
export class TenantAssociationPositionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: TenantAssociationPositionListQueryDto) {
    const { page, limit, search, status, tenantBusinessId, sortBy, sortOrder } = query;
    const where = {
      status: status ? status : ({ not: 'DELETED' } as const),
      ...(tenantBusinessId ? { tenantBusinessId } : {}),
      ...searchClause(search),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.tenantAssociationPosition.findMany({
        where,
        include: POSITION_INCLUDE,
        orderBy: { [sortBy]: sortOrder },
        ...paginate(page, limit),
      }),
      this.prisma.tenantAssociationPosition.count({ where }),
    ]);
    return listResponse(items, total, page, limit);
  }

  async findOne(id: string) {
    const position = await this.prisma.tenantAssociationPosition.findFirst({
      where: { id, status: { not: 'DELETED' } },
      include: POSITION_INCLUDE,
    });
    if (!position) throw new NotFoundException('Association position not found');
    return position;
  }

  async create(dto: CreateTenantAssociationPositionDto) {
    await this.assertBusinessExists(dto.tenantBusinessId);

    const timestamp = now();
    return this.prisma.tenantAssociationPosition.create({
      data: {
        id: newId(),
        systemCode: newSystemCode('TAP'),
        tenantBusinessId: dto.tenantBusinessId,
        positionName: dto.positionName,
        positionNameTamil: dto.positionNameTamil,
        remark: dto.remark,
        // Both of these were missing. This block enumerates its fields rather
        // than spreading `dto`, so a new column is silently dropped on CREATE
        // until somebody adds it here - `showOnApplicationForm` had been
        // accepted by the DTO and discarded by this method since it shipped,
        // which is why a position created with the box unticked came back
        // ticked. `?? undefined` leaves the column default to decide.
        showOnApplicationForm: dto.showOnApplicationForm ?? undefined,
        maxMembers: dto.maxMembers ?? undefined,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      include: POSITION_INCLUDE,
    });
  }

  async update(id: string, dto: UpdateTenantAssociationPositionDto) {
    const position = await this.prisma.tenantAssociationPosition.findFirst({
      where: { id, status: { not: 'DELETED' } },
    });
    if (!position) throw new NotFoundException('Association position not found');
    if (dto.tenantBusinessId) await this.assertBusinessExists(dto.tenantBusinessId);

    return this.prisma.tenantAssociationPosition.update({
      where: { id },
      data: { ...dto, updatedAt: now() },
      include: POSITION_INCLUDE,
    });
  }

  async remove(id: string) {
    const position = await this.prisma.tenantAssociationPosition.findFirst({
      where: { id, status: { not: 'DELETED' } },
    });
    if (!position) throw new NotFoundException('Association position not found');

    const timestamp = now();
    await this.prisma.tenantAssociationPosition.update({
      where: { id },
      data: { status: 'DELETED', deletedAt: timestamp, updatedAt: timestamp },
    });
    return { success: true };
  }

  async restore(id: string) {
    const position = await this.prisma.tenantAssociationPosition.findFirst({
      where: { id, status: 'DELETED' },
    });
    if (!position) {
      throw new NotFoundException('Association position not found or not deleted');
    }
    return this.prisma.tenantAssociationPosition.update({
      where: { id },
      data: { status: 'ACTIVE', deletedAt: null, updatedAt: now() },
      include: POSITION_INCLUDE,
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

  // ---------- Tenant self-service (scoped to the caller's mapped businesses) ----------

  async listMappedBusinesses(tenantUserId: string) {
    const businessIds = await this.getMappedBusinessIds(tenantUserId);
    return this.prisma.tenantBusiness.findMany({
      where: { id: { in: businessIds }, status: { not: 'DELETED' } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  async findAllForTenantUser(
    tenantUserId: string,
    query: TenantAssociationPositionListQueryDto,
  ) {
    const businessIds = await this.getMappedBusinessIds(tenantUserId);
    const { page, limit, search, status, tenantBusinessId, sortBy, sortOrder } = query;
    // A requested business is intersected with the caller's own, never trusted.
    const scopedBusinessIds = tenantBusinessId
      ? businessIds.filter((id) => id === tenantBusinessId)
      : businessIds;
    const where = {
      tenantBusinessId: { in: scopedBusinessIds },
      status: status ? status : ({ not: 'DELETED' } as const),
      ...searchClause(search),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.tenantAssociationPosition.findMany({
        where,
        include: POSITION_INCLUDE,
        orderBy: { [sortBy]: sortOrder },
        ...paginate(page, limit),
      }),
      this.prisma.tenantAssociationPosition.count({ where }),
    ]);
    return listResponse(items, total, page, limit);
  }

  async findOneForTenantUser(tenantUserId: string, id: string) {
    const businessIds = await this.getMappedBusinessIds(tenantUserId);
    const position = await this.prisma.tenantAssociationPosition.findFirst({
      where: { id, tenantBusinessId: { in: businessIds }, status: { not: 'DELETED' } },
      include: POSITION_INCLUDE,
    });
    if (!position) throw new NotFoundException('Association position not found');
    return position;
  }

  async createForTenantUser(tenantUserId: string, dto: CreateTenantAssociationPositionDto) {
    await this.assertBusinessOwned(tenantUserId, dto.tenantBusinessId);
    return this.create(dto);
  }

  async updateForTenantUser(
    tenantUserId: string,
    id: string,
    dto: UpdateTenantAssociationPositionDto,
  ) {
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
