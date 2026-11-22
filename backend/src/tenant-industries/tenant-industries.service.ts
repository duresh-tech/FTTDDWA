import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { newId, newSystemCode, now } from '../common/utils/id.util';
import { listResponse, paginate } from '../common/dto/query.dto';
import { CreateTenantIndustryDto, UpdateTenantIndustryDto } from './dto/tenant-industry.dto';
import { TenantIndustryListQueryDto } from './dto/tenant-industry-query.dto';

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
      { industryName: { contains: search, mode: 'insensitive' as const } },
      { industryNameTamil: { contains: search, mode: 'insensitive' as const } },
      { systemCode: { contains: search, mode: 'insensitive' as const } },
    ],
  };
}

@Injectable()
export class TenantIndustriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: TenantIndustryListQueryDto) {
    const { page, limit, search, status, tenantBusinessId, sortBy, sortOrder } = query;
    const where = {
      status: status ? status : ({ not: 'DELETED' } as const),
      ...(tenantBusinessId ? { tenantBusinessId } : {}),
      ...searchClause(search),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.tenantIndustry.findMany({
        where,
        include: INCLUDE,
        orderBy: { [sortBy]: sortOrder },
        ...paginate(page, limit),
      }),
      this.prisma.tenantIndustry.count({ where }),
    ]);
    return listResponse(items, total, page, limit);
  }

  async findOne(id: string) {
    const row = await this.prisma.tenantIndustry.findFirst({
      where: { id, status: { not: 'DELETED' } },
      include: INCLUDE,
    });
    if (!row) throw new NotFoundException('Industry not found');
    return row;
  }

  async create(dto: CreateTenantIndustryDto) {
    await this.assertBusinessExists(dto.tenantBusinessId);

    const timestamp = now();
    return this.prisma.tenantIndustry.create({
      data: {
        id: newId(),
        systemCode: newSystemCode('IND'),
        tenantBusinessId: dto.tenantBusinessId,
        industryName: dto.industryName,
        industryNameTamil: dto.industryNameTamil,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      include: INCLUDE,
    });
  }

  async update(id: string, dto: UpdateTenantIndustryDto) {
    const row = await this.prisma.tenantIndustry.findFirst({
      where: { id, status: { not: 'DELETED' } },
    });
    if (!row) throw new NotFoundException('Industry not found');
    if (dto.tenantBusinessId) await this.assertBusinessExists(dto.tenantBusinessId);

    return this.prisma.tenantIndustry.update({
      where: { id },
      data: { ...dto, updatedAt: now() },
      include: INCLUDE,
    });
  }

  async remove(id: string) {
    const row = await this.prisma.tenantIndustry.findFirst({
      where: { id, status: { not: 'DELETED' } },
    });
    if (!row) throw new NotFoundException('Industry not found');

    const timestamp = now();
    await this.prisma.tenantIndustry.update({
      where: { id },
      data: { status: 'DELETED', deletedAt: timestamp, updatedAt: timestamp },
    });
    return { success: true };
  }

  async restore(id: string) {
    const row = await this.prisma.tenantIndustry.findFirst({
      where: { id, status: 'DELETED' },
    });
    if (!row) throw new NotFoundException('Industry not found or not deleted');
    return this.prisma.tenantIndustry.update({
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

  // ---------- Tenant self-service (scoped to the caller's mapped businesses) ----------

  async listMappedBusinesses(tenantUserId: string) {
    const businessIds = await this.getMappedBusinessIds(tenantUserId);
    return this.prisma.tenantBusiness.findMany({
      where: { id: { in: businessIds }, status: { not: 'DELETED' } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  async findAllForTenantUser(tenantUserId: string, query: TenantIndustryListQueryDto) {
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
      this.prisma.tenantIndustry.findMany({
        where,
        include: INCLUDE,
        orderBy: { [sortBy]: sortOrder },
        ...paginate(page, limit),
      }),
      this.prisma.tenantIndustry.count({ where }),
    ]);
    return listResponse(items, total, page, limit);
  }

  async findOneForTenantUser(tenantUserId: string, id: string) {
    const businessIds = await this.getMappedBusinessIds(tenantUserId);
    const row = await this.prisma.tenantIndustry.findFirst({
      where: { id, tenantBusinessId: { in: businessIds }, status: { not: 'DELETED' } },
      include: INCLUDE,
    });
    if (!row) throw new NotFoundException('Industry not found');
    return row;
  }

  async createForTenantUser(tenantUserId: string, dto: CreateTenantIndustryDto) {
    await this.assertBusinessOwned(tenantUserId, dto.tenantBusinessId);
    return this.create(dto);
  }

  async updateForTenantUser(tenantUserId: string, id: string, dto: UpdateTenantIndustryDto) {
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
