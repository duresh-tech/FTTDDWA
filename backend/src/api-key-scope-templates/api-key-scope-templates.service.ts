import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { listResponse, paginate } from '../common/dto/query.dto';
import { newId, newSystemCode, now } from '../common/utils/id.util';
import {
  CreateTemplateDto,
  TemplateListQueryDto,
  UpdateTemplateDto,
} from './dto/api-key-scope-template.dto';

const TEMPLATE_INCLUDE = { items: { select: { permissionKey: true } } } as const;

type TemplateRow = { items: { permissionKey: string }[]; [key: string]: unknown };

function serialize(row: TemplateRow) {
  const { items, ...rest } = row;
  return { ...rest, scopes: items.map((i) => i.permissionKey) };
}

/**
 * Named bundles of scopes, so nobody assembles a key out of the whole
 * permission catalogue.
 *
 * Curated system-side only: tenants read them but cannot write them, which is
 * what lets an operator offer "Reporting client" as a choice without also
 * offering every permission in the system as a checkbox.
 */
@Injectable()
export class ApiKeyScopeTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Every scope must be a permission that actually exists. */
  private async assertScopesExist(scopes: string[]) {
    const unique = [...new Set(scopes)];
    const found = await this.prisma.permission.findMany({
      where: { permissionKey: { in: unique } },
      select: { permissionKey: true },
    });
    const known = new Set(found.map((p) => p.permissionKey));
    const unknown = unique.filter((scope) => !known.has(scope));
    if (unknown.length > 0) {
      throw new BadRequestException(`No such permission: ${unknown.join(', ')}`);
    }
  }

  private async writeItems(templateId: string, scopes: string[]) {
    const unique = [...new Set(scopes)];
    await this.prisma.apiKeyScopeTemplateItem.deleteMany({ where: { templateId } });
    const timestamp = now();
    await this.prisma.apiKeyScopeTemplateItem.createMany({
      data: unique.map((permissionKey) => ({ templateId, permissionKey, createdAt: timestamp })),
      skipDuplicates: true,
    });
  }

  async findAll(query: TemplateListQueryDto) {
    const where = {
      status: query.status ?? { not: 'DELETED' as const },
      ...(query.isTenant ? { isTenant: query.isTenant === 'true' } : {}),
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' as const } }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.apiKeyScopeTemplate.findMany({
        where,
        include: TEMPLATE_INCLUDE,
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        ...paginate(query.page, query.limit),
      }),
      this.prisma.apiKeyScopeTemplate.count({ where }),
    ]);

    return listResponse(
      items.map((row) => serialize(row as TemplateRow)),
      total,
      query.page,
      query.limit,
    );
  }

  async findOne(id: string) {
    const row = await this.prisma.apiKeyScopeTemplate.findFirst({
      where: { id, status: { not: 'DELETED' } },
      include: TEMPLATE_INCLUDE,
    });
    if (!row) throw new NotFoundException('Scope template not found');
    return serialize(row as TemplateRow);
  }

  /**
   * The whole permission catalogue, for the template picker.
   *
   * Unpaged on purpose: the ordinary permission list caps at 100, and a
   * silently truncated catalogue produces templates missing scopes nobody
   * noticed were absent.
   */
  async permissionCatalogue() {
    const items = await this.prisma.permission.findMany({
      where: { status: 'ACTIVE' },
      select: { permissionKey: true, moduleName: true, displayName: true },
      orderBy: [{ moduleName: 'asc' }, { permissionKey: 'asc' }],
    });
    return { items, total: items.length };
  }

  async create(dto: CreateTemplateDto) {
    await this.assertScopesExist(dto.scopes);

    const clash = await this.prisma.apiKeyScopeTemplate.findUnique({ where: { name: dto.name } });
    if (clash) throw new ConflictException('A template with that name already exists');

    const timestamp = now();
    const created = await this.prisma.apiKeyScopeTemplate.create({
      data: {
        id: newId(),
        systemCode: newSystemCode('AKT'),
        name: dto.name,
        description: dto.description ?? null,
        isTenant: dto.isTenant,
        displayOrder: dto.displayOrder,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    });
    await this.writeItems(created.id, dto.scopes);
    return this.findOne(created.id);
  }

  async update(id: string, dto: UpdateTemplateDto) {
    await this.findOne(id);
    if (dto.scopes) await this.assertScopesExist(dto.scopes);

    const { scopes, ...rest } = dto;
    await this.prisma.apiKeyScopeTemplate.update({
      where: { id },
      data: { ...rest, updatedAt: now() },
    });
    if (scopes) await this.writeItems(id, scopes);
    return this.findOne(id);
  }

  /**
   * Soft delete. Keys already issued from this template keep their scopes: a
   * template is a shortcut at creation time, not a live link, so removing one
   * never silently changes what an existing credential can do.
   */
  async remove(id: string) {
    await this.findOne(id);
    const timestamp = now();
    await this.prisma.apiKeyScopeTemplate.update({
      where: { id },
      data: { status: 'DELETED', deletedAt: timestamp, updatedAt: timestamp },
    });
    return { success: true };
  }

  /**
   * Templates a tenant may choose from, each marked with whether the caller
   * can actually grant it.
   *
   * A non-grantable template is returned rather than hidden: an option that
   * quietly vanishes leaves the operator wondering why a colleague can see it.
   */
  async findForTenant(callerPermissions: string[]) {
    const rows = await this.prisma.apiKeyScopeTemplate.findMany({
      where: { status: 'ACTIVE', isTenant: true },
      include: TEMPLATE_INCLUDE,
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });

    const held = new Set(callerPermissions);
    return rows.map((row) => {
      const scopes = row.items.map((i) => i.permissionKey);
      const missingScopes = scopes.filter((scope) => !held.has(scope));
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        scopes,
        grantable: missingScopes.length === 0,
        missingScopes,
      };
    });
  }
}
