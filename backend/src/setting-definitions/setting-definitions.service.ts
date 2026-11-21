import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsSyncService } from '../settings-sync/settings-sync.service';
import { newId, newSystemCode, now } from '../common/utils/id.util';
import { listResponse, paginate } from '../common/dto/query.dto';
import {
  CreateSettingDefinitionDto,
  UpdateSettingDefinitionDto,
  validateValueForValueType,
} from './dto/setting-definition.dto';
import { SettingDefinitionListQueryDto } from './dto/setting-definition-query.dto';

@Injectable()
export class SettingDefinitionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsSync: SettingsSyncService,
  ) {}

  async findAll(query: SettingDefinitionListQueryDto) {
    const { page, limit, search, category, status, sortBy, sortOrder } = query;
    const where = {
      ...(status ? { status } : {}),
      ...(category ? { category } : {}),
      ...(search
        ? {
            OR: [
              { settingKey: { contains: search, mode: 'insensitive' as const } },
              { settingLabel: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.settingDefinition.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        ...paginate(page, limit),
      }),
      this.prisma.settingDefinition.count({ where }),
    ]);
    return listResponse(items, total, page, limit);
  }

  async findOne(id: string) {
    const definition = await this.prisma.settingDefinition.findUnique({ where: { id } });
    if (!definition) throw new NotFoundException('Setting definition not found');
    return definition;
  }

  async create(dto: CreateSettingDefinitionDto, actorId?: string) {
    // settingKey is the identity businesses hold their copies by, so a
    // duplicate is a conflict rather than an update.
    const existing = await this.prisma.settingDefinition.findFirst({
      where: { settingKey: { equals: dto.settingKey, mode: 'insensitive' } },
    });
    if (existing) throw new ConflictException('settingKey already exists');

    const timestamp = now();
    const definition = await this.prisma.settingDefinition.create({
      data: {
        id: newId(),
        systemCode: newSystemCode('SDF'),
        ...dto,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    });

    if (definition.autoSyncToExistingTenants) {
      await this.settingsSync.sync({ mode: 'ALL', dryRun: false }, actorId);
    }
    return definition;
  }

  async update(id: string, dto: UpdateSettingDefinitionDto, actorId?: string) {
    const definition = await this.prisma.settingDefinition.findUnique({ where: { id } });
    if (!definition) throw new NotFoundException('Setting definition not found');

    if (dto.defaultValue !== undefined) {
      // Against the definition's own valueType, which cannot be edited, and
      // the incoming rules if they are also changing in this same call.
      const validationRules = dto.validationRules ?? definition.validationRules;
      const error = validateValueForValueType(
        definition.valueType,
        dto.defaultValue,
        validationRules,
      );
      if (error) throw new BadRequestException(`defaultValue ${error}`);
    }

    const updated = await this.prisma.settingDefinition.update({
      where: { id },
      data: { ...dto, updatedAt: now() },
    });

    // Turning auto-sync ON is itself the instruction to backfill. Only on the
    // transition, so repeated saves of an already-syncing definition do not
    // each walk every business.
    if (!definition.autoSyncToExistingTenants && updated.autoSyncToExistingTenants) {
      await this.settingsSync.sync({ mode: 'ALL', dryRun: false }, actorId);
    }
    return updated;
  }
}
