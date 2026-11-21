import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { newId, newSystemCode, now } from '../common/utils/id.util';
import { listResponse, paginate } from '../common/dto/query.dto';
import { SyncSettingsDto } from './dto/sync-settings.dto';
import { SyncLogListQueryDto } from './dto/sync-log-query.dto';

@Injectable()
export class SettingsSyncService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Backfills definitions to businesses that already exist.
   *
   * A business created after a definition gets it from
   * `copyDefaultsForBusiness` at creation time. This is the other half: for
   * each targeted business, insert a row for every ACTIVE definition the
   * business has no row for, matched by `settingKey`.
   *
   * It NEVER touches an existing row. A business that has already customised a
   * value keeps it, which is what makes the command safe to re-run - and it is
   * re-run on every `npm run seed`. `dryRun` logs what would happen and writes
   * nothing to `tenant_business_settings`.
   */
  async sync(dto: SyncSettingsDto, actorId?: string) {
    const tenantBusinessIds = await this.resolveTargetBusinessIds(dto);
    const definitions = await this.prisma.settingDefinition.findMany({
      where: { status: 'ACTIVE' },
    });

    let inserted = 0;
    let skipped = 0;
    let failed = 0;
    const timestamp = now();

    for (const tenantBusinessId of tenantBusinessIds) {
      const existing = await this.prisma.tenantBusinessSetting.findMany({
        where: { tenantBusinessId, status: { not: 'DELETED' } },
        select: { settingKey: true },
      });
      const existingKeys = new Set(existing.map((r) => r.settingKey));
      const missing = definitions.filter((def) => !existingKeys.has(def.settingKey));
      const present = definitions.filter((def) => existingKeys.has(def.settingKey));

      const logs: Prisma.TenantBusinessSettingSyncLogCreateManyInput[] = present.map(
        (def) => ({
          id: newId(),
          tenantBusinessId,
          settingDefinitionId: def.id,
          action: 'SKIPPED' as const,
          remarks: 'Already present',
          syncedBy: actorId,
          syncedAt: timestamp,
        }),
      );
      skipped += present.length;

      if (missing.length > 0) {
        if (dto.dryRun) {
          logs.push(
            ...missing.map((def) => ({
              id: newId(),
              tenantBusinessId,
              settingDefinitionId: def.id,
              action: 'INSERTED' as const,
              remarks: 'Dry run - not actually inserted',
              syncedBy: actorId,
              syncedAt: timestamp,
            })),
          );
          inserted += missing.length;
        } else {
          try {
            await this.prisma.tenantBusinessSetting.createMany({
              // Every column here must match copyDefaultsForBusiness(), or a
              // backfilled business renders differently from a newly created
              // one. isVisible in particular: omitting it would silently
              // default a hidden setting to visible on exactly the businesses
              // that got it by backfill.
              data: missing.map((def) => ({
                id: newId(),
                systemCode: newSystemCode('TBS'),
                tenantBusinessId,
                settingDefinitionId: def.id,
                category: def.category,
                subCategory: def.subCategory,
                settingKey: def.settingKey,
                settingLabel: def.settingLabel,
                valueType: def.valueType,
                settingValue: def.defaultValue,
                description: def.description,
                validationRules: def.validationRules,
                isEncrypted: def.isEncrypted,
                isReadonly: def.isReadonly,
                isVisible: def.isVisible,
                sortOrder: def.sortOrder,
                createdBy: actorId,
                updatedBy: actorId,
                createdAt: timestamp,
                updatedAt: timestamp,
              })),
            });
            logs.push(
              ...missing.map((def) => ({
                id: newId(),
                tenantBusinessId,
                settingDefinitionId: def.id,
                action: 'INSERTED' as const,
                remarks: null,
                syncedBy: actorId,
                syncedAt: timestamp,
              })),
            );
            inserted += missing.length;
          } catch (e) {
            // One business's failure must not abandon the rest, so the error
            // is logged per definition and the loop continues.
            logs.push(
              ...missing.map((def) => ({
                id: newId(),
                tenantBusinessId,
                settingDefinitionId: def.id,
                action: 'FAILED' as const,
                remarks: (e instanceof Error ? e.message : 'Unknown error').slice(0, 250),
                syncedBy: actorId,
                syncedAt: timestamp,
              })),
            );
            failed += missing.length;
          }
        }
      }

      if (logs.length > 0) {
        await this.prisma.tenantBusinessSettingSyncLog.createMany({ data: logs });
      }
    }

    return {
      dryRun: dto.dryRun,
      businessesProcessed: tenantBusinessIds.length,
      inserted,
      skipped,
      failed,
    };
  }

  async findSyncLogs(query: SyncLogListQueryDto) {
    const { page, limit, tenantBusinessId, settingDefinitionId, action, sortBy, sortOrder } =
      query;
    const where = {
      ...(tenantBusinessId ? { tenantBusinessId } : {}),
      ...(settingDefinitionId ? { settingDefinitionId } : {}),
      ...(action ? { action } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.tenantBusinessSettingSyncLog.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        ...paginate(page, limit),
      }),
      this.prisma.tenantBusinessSettingSyncLog.count({ where }),
    ]);
    return listResponse(items, total, page, limit);
  }

  private async resolveTargetBusinessIds(dto: SyncSettingsDto): Promise<string[]> {
    if (dto.mode === 'ALL') {
      const businesses = await this.prisma.tenantBusiness.findMany({
        where: { status: { not: 'DELETED' } },
        select: { id: true },
      });
      return businesses.map((b) => b.id);
    }
    return dto.tenantBusinessIds ?? [];
  }
}
