import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { newId, newSystemCode, now } from '../common/utils/id.util';
import { listResponse, paginate } from '../common/dto/query.dto';
import {
  emptyLayout,
  IdCardLayout,
} from '../tenant-id-cards/id-card-layout.schema';
import {
  CreateIdCardTemplateDto,
  UpdateIdCardTemplateDto,
} from './dto/id-card-template.dto';
import { IdCardTemplateListQueryDto } from './dto/id-card-template-query.dto';

const INCLUDE = {
  tenantBusiness: { select: { id: true, systemCode: true, name: true } },
};

/**
 * Search clause, factored out so the two list methods cannot drift.
 *
 * `mode: 'insensitive' as const` on every clause. Postgres compares text
 * case-sensitively, and the `as const` is required - `mode` widens to `string`
 * in a standalone where object and Prisma's types reject it.
 */
function searchClause(search?: string) {
  if (!search) return {};
  const contains = { contains: search, mode: 'insensitive' as const };
  return {
    OR: [
      { name: contains },
      { description: contains },
      { systemCode: contains },
    ],
  };
}

@Injectable()
export class TenantIdCardTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- System-admin cross-tenant surface ----------

  async findAll(query: IdCardTemplateListQueryDto) {
    const { page, limit, search, status, tenantBusinessId, sortBy, sortOrder } = query;
    const where = {
      ...(tenantBusinessId ? { tenantBusinessId } : {}),
      status: status ? status : ({ not: 'DELETED' } as const),
      ...searchClause(search),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.tenantIdCardTemplate.findMany({
        where,
        include: INCLUDE,
        orderBy: { [sortBy]: sortOrder },
        ...paginate(page, limit),
      }),
      this.prisma.tenantIdCardTemplate.count({ where }),
    ]);
    return listResponse(items, total, page, limit);
  }

  async findOne(id: string) {
    const row = await this.prisma.tenantIdCardTemplate.findFirst({
      where: { id, status: { not: 'DELETED' } },
      include: INCLUDE,
    });
    if (!row) throw new NotFoundException('ID card template not found');
    return row;
  }

  async create(dto: CreateIdCardTemplateDto) {
    const timestamp = now();
    const layout: IdCardLayout =
      dto.layout ?? emptyLayout(dto.widthMm, dto.heightMm);
    // The card size lives in two places - its own columns, for listing and
    // sorting, and inside the layout, for the renderer. Reconciled here so
    // they cannot disagree, with the columns winning.
    layout.card = { widthMm: dto.widthMm, heightMm: dto.heightMm };

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) await this.clearDefault(tx, dto.tenantBusinessId);
      // The first template a business creates becomes its default, so
      // generation works without anyone having to think about the flag.
      const isFirst =
        (await tx.tenantIdCardTemplate.count({
          where: { tenantBusinessId: dto.tenantBusinessId, status: { not: 'DELETED' } },
        })) === 0;

      return tx.tenantIdCardTemplate.create({
        data: {
          id: newId(),
          systemCode: newSystemCode('ICT'),
          tenantBusinessId: dto.tenantBusinessId,
          name: dto.name,
          description: dto.description,
          widthMm: new Prisma.Decimal(dto.widthMm),
          heightMm: new Prisma.Decimal(dto.heightMm),
          layout: JSON.stringify(layout),
          isDefault: dto.isDefault ?? isFirst,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        include: INCLUDE,
      });
    });
  }

  async update(id: string, dto: UpdateIdCardTemplateDto) {
    const row = await this.findOne(id);

    const widthMm = dto.widthMm ?? Number(row.widthMm);
    const heightMm = dto.heightMm ?? Number(row.heightMm);
    let layout: string | undefined;
    if (dto.layout) {
      layout = JSON.stringify({ ...dto.layout, card: { widthMm, heightMm } });
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) await this.clearDefault(tx, row.tenantBusinessId, id);
      return tx.tenantIdCardTemplate.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.widthMm !== undefined ? { widthMm: new Prisma.Decimal(widthMm) } : {}),
          ...(dto.heightMm !== undefined ? { heightMm: new Prisma.Decimal(heightMm) } : {}),
          ...(layout !== undefined ? { layout } : {}),
          ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          updatedAt: now(),
        },
        include: INCLUDE,
      });
    });
  }

  /** Makes one template the business's default, clearing whichever held it. */
  async setDefault(id: string) {
    const row = await this.findOne(id);
    return this.prisma.$transaction(async (tx) => {
      await this.clearDefault(tx, row.tenantBusinessId, id);
      return tx.tenantIdCardTemplate.update({
        where: { id },
        data: { isDefault: true, updatedAt: now() },
        include: INCLUDE,
      });
    });
  }

  async remove(id: string) {
    const row = await this.findOne(id);
    // A template that cards were generated from is still referenced by those
    // rows, so this is a soft delete like everything else here - the FK is
    // RESTRICT and a hard delete would fail anyway.
    await this.prisma.tenantIdCardTemplate.update({
      where: { id },
      data: {
        status: 'DELETED',
        // A deleted template must not stay the default, or generation would
        // keep selecting something nobody can see or edit.
        isDefault: false,
        deletedAt: now(),
        updatedAt: now(),
      },
    });
    void row;
    return { success: true };
  }

  async restore(id: string) {
    const row = await this.prisma.tenantIdCardTemplate.findFirst({
      where: { id, status: 'DELETED' },
    });
    if (!row) throw new NotFoundException('Deleted ID card template not found');
    return this.prisma.tenantIdCardTemplate.update({
      where: { id },
      // Comes back INACTIVE, never as the default: a design that was deleted
      // deserves another look before it starts printing cards again.
      data: { status: 'INACTIVE', isDefault: false, deletedAt: null, updatedAt: now() },
      include: INCLUDE,
    });
  }

  // ---------- Tenant self-service ----------

  async listMappedBusinesses(tenantUserId: string) {
    const businessIds = await this.getMappedBusinessIds(tenantUserId);
    return this.prisma.tenantBusiness.findMany({
      where: { id: { in: businessIds }, status: { not: 'DELETED' } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  async findAllForTenantUser(tenantUserId: string, query: IdCardTemplateListQueryDto) {
    const businessIds = await this.getMappedBusinessIds(tenantUserId);
    // A requested business is intersected with the caller's own, never trusted.
    const scoped = query.tenantBusinessId
      ? businessIds.filter((id) => id === query.tenantBusinessId)
      : businessIds;
    const { page, limit, search, status, sortBy, sortOrder } = query;
    const where = {
      tenantBusinessId: { in: scoped },
      status: status ? status : ({ not: 'DELETED' } as const),
      ...searchClause(search),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.tenantIdCardTemplate.findMany({
        where,
        include: INCLUDE,
        orderBy: { [sortBy]: sortOrder },
        ...paginate(page, limit),
      }),
      this.prisma.tenantIdCardTemplate.count({ where }),
    ]);
    return listResponse(items, total, page, limit);
  }

  async findOneForTenantUser(tenantUserId: string, id: string) {
    const businessIds = await this.getMappedBusinessIds(tenantUserId);
    const row = await this.prisma.tenantIdCardTemplate.findFirst({
      where: { id, tenantBusinessId: { in: businessIds }, status: { not: 'DELETED' } },
      include: INCLUDE,
    });
    if (!row) throw new NotFoundException('ID card template not found');
    return row;
  }

  async createForTenantUser(tenantUserId: string, dto: CreateIdCardTemplateDto) {
    await this.assertBusinessOwned(tenantUserId, dto.tenantBusinessId);
    return this.create(dto);
  }

  async updateForTenantUser(
    tenantUserId: string,
    id: string,
    dto: UpdateIdCardTemplateDto,
  ) {
    await this.findOneForTenantUser(tenantUserId, id);
    if (dto.tenantBusinessId) {
      throw new BadRequestException('A template cannot be moved to another business');
    }
    return this.update(id, dto);
  }

  async setDefaultForTenantUser(tenantUserId: string, id: string) {
    await this.findOneForTenantUser(tenantUserId, id);
    return this.setDefault(id);
  }

  async removeForTenantUser(tenantUserId: string, id: string) {
    await this.findOneForTenantUser(tenantUserId, id);
    return this.remove(id);
  }

  // ---------- Internals ----------

  /**
   * Clears the default flag across a business.
   *
   * Called inside the caller's transaction, so "exactly one default" is an
   * invariant rather than a convention that two concurrent saves could break.
   */
  private async clearDefault(
    tx: Prisma.TransactionClient,
    tenantBusinessId: string,
    exceptId?: string,
  ): Promise<void> {
    await tx.tenantIdCardTemplate.updateMany({
      where: {
        tenantBusinessId,
        isDefault: true,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      data: { isDefault: false },
    });
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
