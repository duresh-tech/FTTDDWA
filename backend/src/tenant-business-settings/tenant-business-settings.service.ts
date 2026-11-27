import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { decryptValue, encryptValue } from '../common/utils/encryption.util';
import { newId, newSystemCode, now } from '../common/utils/id.util';
import { listResponse, paginate } from '../common/dto/query.dto';
import { validateValueForValueType } from '../setting-definitions/dto/setting-definition.dto';
import {
  BatchUpdateTenantBusinessSettingDto,
  UpdateTenantBusinessSettingDto,
} from './dto/tenant-business-setting.dto';
import { TenantBusinessSettingListQueryDto } from './dto/tenant-business-setting-query.dto';

type SettingRow = {
  isEncrypted: boolean;
  settingValue: string | null;
};

/**
 * The position applicants are filed under, when a business fixes one.
 *
 * Exported rather than re-declared: `memberRegister.enabled` is spelled out in
 * three separate files already, and a key that only one of them gets wrong is
 * a setting that silently stops working.
 */
export const APPLICANT_POSITION_SETTING_KEY = 'memberRegister.positionId';

/**
 * One choice offered by a `ref` setting's picker.
 *
 * `labelTamil` rides along rather than being resolved later: every lookup in
 * this system carries a Tamil twin, and a picker that shows only the English
 * name makes the operator guess which record they mean.
 */
export type RefOption = {
  id: string;
  label: string;
  labelTamil: string | null;
};

/**
 * Blanks encrypted values on the way out. The ciphertext never leaves the
 * server, and a blank on the way back in means "unchanged" rather than
 * "clear it" - see update().
 */
function mask<T extends SettingRow>(row: T): T {
  if (!row.isEncrypted || row.settingValue === null) return row;
  return { ...row, settingValue: '' };
}

/**
 * A FILE setting holds a RELATIVE storage path, never a URL and never an
 * absolute or escaping path. Returns a message fragment, or null when fine.
 *
 * This is all the checking a path gets here. The richer model - per-business
 * folders, and proving a path belongs to the business that is saving it -
 * needs an upload-folder subsystem this project does not have; uploads land in
 * one place and are addressed by the path the upload endpoint returned.
 */
function checkSettingPath(value: string): string | null {
  if (value === '') return null;
  if (value.startsWith('/') || value.includes('\\')) {
    return 'value must be a relative storage path';
  }
  if (value.split('/').includes('..')) {
    return 'value must not contain ".."';
  }
  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value)) {
    return 'value must be a storage path, not a URL';
  }
  return null;
}

@Injectable()
export class TenantBusinessSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- Business-creation hook ----------

  /**
   * Gives a new tenant business its own full, independently-editable copy of
   * every ACTIVE setting definition.
   *
   * Takes a transaction client and MUST be called inside the same transaction
   * that creates the business, so a failure here rolls the business back too -
   * a business with no settings rows would render an empty settings screen and
   * break any code that reads a setting by key.
   */
  async copyDefaultsForBusiness(
    tx: Prisma.TransactionClient,
    tenantBusinessId: string,
    actorId?: string,
  ) {
    const definitions = await tx.settingDefinition.findMany({
      where: { status: 'ACTIVE' },
    });
    if (definitions.length === 0) return;

    const timestamp = now();
    // Every column here must match the backfill in SettingsSyncService, or a
    // business created now renders differently from one backfilled later.
    await tx.tenantBusinessSetting.createMany({
      data: definitions.map((def) => ({
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
  }

  // ---------- How application code reads settings ----------

  /**
   * Decrypted `key -> value` map for a business. Pass `keys` to limit the
   * query. This is how application code reads settings; it deliberately does
   * not mask, because the caller is the server itself.
   *
   * It does NOT fall back to the definition's defaultValue. The default is
   * applied once, when the row is created; a missing or null row reads as
   * absent here and every caller must supply its own fallback. Assuming
   * otherwise is the easy mistake - a business whose row was never created
   * would silently take the catalogue's current default instead of the one it
   * was set up with.
   */
  async getSettingsMapForBusiness(
    tenantBusinessId: string,
    keys?: string[],
  ): Promise<Record<string, string>> {
    const rows = await this.prisma.tenantBusinessSetting.findMany({
      where: {
        tenantBusinessId,
        status: 'ACTIVE',
        ...(keys ? { settingKey: { in: keys } } : {}),
      },
    });
    const map: Record<string, string> = {};
    for (const row of rows) {
      if (row.settingValue === null) continue;
      map[row.settingKey] = row.isEncrypted
        ? decryptValue(row.settingValue)
        : row.settingValue;
    }
    return map;
  }

  /**
   * A BOOLEAN setting read as a feature flag, where UNSET means ENABLED.
   *
   * Which way an unset value falls is the whole question.
   * getSettingsMapForBusiness() deliberately omits a key with no row and
   * applies no default, so a business whose backfill has not run yet reads as
   * absent - and treating that as "off" would shut it out of a feature it
   * never chose to disable. Only an explicit 'false' turns anything off.
   */
  async isSettingEnabled(tenantBusinessId: string, settingKey: string): Promise<boolean> {
    const map = await this.getSettingsMapForBusiness(tenantBusinessId, [settingKey]);
    return map[settingKey] !== 'false';
  }

  /**
   * The position every APPLICANT is filed under, or null when they choose.
   *
   * Note the polarity, which is the opposite of isSettingEnabled(): absent
   * means NOT fixed. An absent key is what every business has until the
   * settings backfill runs, so the absent case has to be the one that changes
   * nothing.
   *
   * It re-reads the row rather than trusting the stored id. `ref` renders a
   * picker but enforces nothing on write, so this value can name a position
   * that was since deleted, or - if someone set it through the API rather than
   * the screen - one belonging to another business entirely. A stale id
   * degrades to "applicants choose", never to a cross-tenant leak.
   */
  async resolveApplicantPositionId(tenantBusinessId: string): Promise<string | null> {
    const map = await this.getSettingsMapForBusiness(tenantBusinessId, [
      APPLICANT_POSITION_SETTING_KEY,
    ]);
    const positionId = map[APPLICANT_POSITION_SETTING_KEY]?.trim();
    if (!positionId) return null;

    const position = await this.prisma.tenantAssociationPosition.findFirst({
      where: { id: positionId, tenantBusinessId, status: { not: 'DELETED' } },
      select: { id: true },
    });
    return position?.id ?? null;
  }

  // ---------- System-admin cross-tenant surface ----------

  async findAll(query: TenantBusinessSettingListQueryDto) {
    const { page, limit, tenantBusinessId, category, status, sortBy, sortOrder } = query;
    const where = {
      tenantBusinessId,
      status: status ? status : ({ not: 'DELETED' } as const),
      ...(category ? { category: { equals: category, mode: 'insensitive' as const } } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.tenantBusinessSetting.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        ...paginate(page, limit),
      }),
      this.prisma.tenantBusinessSetting.count({ where }),
    ]);
    return listResponse(items.map(mask), total, page, limit);
  }

  async findOne(id: string) {
    const row = await this.prisma.tenantBusinessSetting.findFirst({
      where: { id, status: { not: 'DELETED' } },
    });
    if (!row) throw new NotFoundException('Tenant business setting not found');
    return mask(row);
  }

  async update(id: string, dto: UpdateTenantBusinessSettingDto, actorId?: string) {
    const row = await this.prisma.tenantBusinessSetting.findFirst({
      where: { id, status: { not: 'DELETED' } },
    });
    if (!row) throw new NotFoundException('Tenant business setting not found');

    let settingValue = row.settingValue;
    if (dto.settingValue !== undefined) {
      if (row.isEncrypted && dto.settingValue === '') {
        // An encrypted setting reads back masked as '', so a blank submit means
        // "I didn't change the secret", not "clear it". Encrypting '' here
        // would destroy a working credential and only surface later, somewhere
        // unrelated.
        //
        // KEEP THIS CASE AHEAD OF THE NEXT ONE AND KEEP THE TWO APART. They
        // test nearly the same thing and mean opposite things, so folding them
        // together silently destroys stored secrets.
        settingValue = row.settingValue;
      } else if (dto.settingValue === '') {
        // Blank means "no value", not "a value that must parse". Validating ''
        // against the valueType would make an optional EMAIL or PHONE
        // impossible to clear - EMAIL_PATTERN rejects '' outright and
        // PHONE_PATTERN demands at least six characters - and the tenant screen
        // saves every edited row in ONE transaction, so a single blanked field
        // would block the whole form.
        //
        // Safe because isRequired is a label here and not a write rule: it is
        // stored, returned and badged on the definitions screen, and enforced
        // on no write path anywhere. Blank already cleared a STRING; this makes
        // every valueType agree.
        settingValue = null;
      } else {
        // Against the valueType and rules on THIS ROW, not the definition's
        // current ones - the row is what the business was set up with.
        const error = validateValueForValueType(
          row.valueType,
          dto.settingValue,
          row.validationRules,
        );
        if (error) throw new BadRequestException(`settingValue ${error}`);
        if (row.valueType === 'FILE') {
          const pathError = checkSettingPath(dto.settingValue);
          if (pathError) throw new BadRequestException(`settingValue ${pathError}`);
        }
        settingValue = row.isEncrypted ? encryptValue(dto.settingValue) : dto.settingValue;
      }
    }

    const updated = await this.prisma.tenantBusinessSetting.update({
      where: { id },
      data: {
        settingValue,
        ...(dto.isReadonly !== undefined ? { isReadonly: dto.isReadonly } : {}),
        updatedBy: actorId,
        updatedAt: now(),
      },
    });
    return mask(updated);
  }

  // ---------- Tenant self-service (the caller's own mapped business) ----------

  /**
   * @param tenantBusinessId Optional. Omitted, this resolves to the caller's
   * mapped business. Given, it lets a screen that works across several mapped
   * businesses read the right one - and it is checked against the caller's
   * mappings rather than trusted.
   */
  async findAllForTenantUser(
    tenantUserId: string,
    category?: string,
    tenantBusinessId?: string,
  ) {
    const resolvedBusinessId = tenantBusinessId
      ? await this.assertBusinessMapped(tenantUserId, tenantBusinessId)
      : await this.getMyBusinessId(tenantUserId);
    const rows = await this.prisma.tenantBusinessSetting.findMany({
      // Deliberately NOT filtered on isVisible. A hidden setting is still read
      // by application code, so the API returns it and carries the flag; the
      // settings screen is what leaves it out.
      where: {
        tenantBusinessId: resolvedBusinessId,
        status: 'ACTIVE',
        ...(category ? { category: { equals: category, mode: 'insensitive' as const } } : {}),
      },
      orderBy: { sortOrder: 'asc' },
    });
    return rows.map(mask);
  }

  async findOneByKeyForTenantUser(tenantUserId: string, settingKey: string) {
    const tenantBusinessId = await this.getMyBusinessId(tenantUserId);
    const row = await this.prisma.tenantBusinessSetting.findFirst({
      where: {
        tenantBusinessId,
        settingKey: { equals: settingKey, mode: 'insensitive' },
        status: 'ACTIVE',
      },
    });
    if (!row) throw new NotFoundException('Setting not found');
    return mask(row);
  }

  /**
   * Saves a screenful of settings as one unit - a rejected value rolls the
   * whole batch back rather than leaving half a form saved, which would be
   * worse than refusing it: the screen would show some values changed and some
   * not, with no indication which.
   */
  async batchUpdateForTenantUser(
    tenantUserId: string,
    dto: BatchUpdateTenantBusinessSettingDto,
  ) {
    const tenantBusinessId = await this.getMyBusinessId(tenantUserId);
    const timestamp = now();

    return this.prisma.$transaction(async (tx) => {
      const results: Awaited<ReturnType<typeof tx.tenantBusinessSetting.update>>[] = [];
      for (const { settingKey, settingValue } of dto.updates) {
        const row = await tx.tenantBusinessSetting.findFirst({
          where: {
            tenantBusinessId,
            settingKey: { equals: settingKey, mode: 'insensitive' },
            status: 'ACTIVE',
          },
        });
        if (!row) throw new NotFoundException(`Setting "${settingKey}" not found`);
        if (row.isReadonly) {
          throw new ForbiddenException(`Setting "${settingKey}" is locked for this business`);
        }

        // Blank on an encrypted setting means "left untouched" - see update().
        if (row.isEncrypted && settingValue === '') {
          results.push(mask(row));
          continue;
        }

        // Blank on anything else means "no value". This must stay a SEPARATE
        // case from the encrypted one directly above, which means the opposite
        // - see update() for the full reasoning. Without it, clearing an
        // optional EMAIL or PHONE fails validation and rolls back every other
        // row in the same save.
        if (settingValue === '') {
          const cleared = await tx.tenantBusinessSetting.update({
            where: { id: row.id },
            data: { settingValue: null, updatedBy: tenantUserId, updatedAt: timestamp },
          });
          results.push(mask(cleared));
          continue;
        }

        const error = validateValueForValueType(
          row.valueType,
          settingValue,
          row.validationRules,
        );
        if (error) throw new BadRequestException(`${settingKey}: ${error}`);
        // Checked on this path too, not just the system one: a tenant can
        // submit any string for a FILE setting.
        if (row.valueType === 'FILE') {
          const pathError = checkSettingPath(settingValue);
          if (pathError) throw new BadRequestException(`${settingKey}: ${pathError}`);
        }

        const updated = await tx.tenantBusinessSetting.update({
          where: { id: row.id },
          data: {
            settingValue: row.isEncrypted ? encryptValue(settingValue) : settingValue,
            updatedBy: tenantUserId,
            updatedAt: timestamp,
          },
        });
        results.push(mask(updated));
      }
      return results;
    });
  }

  // ---------- Reference options (the `ref` rendering hint) ----------

  /**
   * The records a `ref` setting may point at.
   *
   * A setting whose validationRules carry `ref` holds another resource's UUID
   * in a plain STRING - a key-value store has no foreign key to offer - and
   * the settings screen renders a picker rather than a UUID box. This switch
   * is the one place that says which ref name means which table.
   *
   * An unknown ref returns [] instead of throwing. `ref` is free text typed
   * into the catalogue, and a typo there must not turn the whole settings
   * screen into a 500.
   *
   * `parentId` narrows a ref that is only meaningful under a parent - the
   * catalogue names it with `refParent`. **A ref that needs a parent and is
   * given none returns [], never the unfiltered list.** Falling back to
   * everything is exactly the wrong answer: it is what lets a district from
   * one state be filed under another, which is the thing this narrowing
   * exists to prevent.
   *
   * `states` -> `districts` -> `taluks` follows the real FK chain.
   * `associationPositions` takes no parent: positions hang off the business.
   */
  async listRefOptions(
    ref: string,
    tenantBusinessId: string,
    parentId?: string,
  ): Promise<RefOption[]> {
    if (!tenantBusinessId) return [];
    const owned = { tenantBusinessId, status: { not: 'DELETED' as const } };

    switch (ref) {
      case 'states': {
        const rows = await this.prisma.tenantState.findMany({
          where: owned,
          select: { id: true, stateName: true, stateNameTamil: true },
          orderBy: { stateName: 'asc' },
        });
        return rows.map((row) => ({
          id: row.id,
          label: row.stateName,
          labelTamil: row.stateNameTamil,
        }));
      }
      case 'districts': {
        if (!parentId) return [];
        const rows = await this.prisma.tenantDistrict.findMany({
          where: { ...owned, stateId: parentId },
          select: { id: true, districtName: true, districtNameTamil: true },
          orderBy: { districtName: 'asc' },
        });
        return rows.map((row) => ({
          id: row.id,
          label: row.districtName,
          labelTamil: row.districtNameTamil,
        }));
      }
      case 'taluks': {
        if (!parentId) return [];
        const rows = await this.prisma.tenantTaluk.findMany({
          where: { ...owned, districtId: parentId },
          select: { id: true, talukName: true, talukNameTamil: true },
          orderBy: { talukName: 'asc' },
        });
        return rows.map((row) => ({
          id: row.id,
          label: row.talukName,
          labelTamil: row.talukNameTamil,
        }));
      }
      case 'associationPositions': {
        const rows = await this.prisma.tenantAssociationPosition.findMany({
          // EVERY position this business has, not only the ones flagged
          // `showOnApplicationForm`. That flag decides what a stranger may
          // claim about themselves; this setting is what staff PIN applicants
          // to, and the public options endpoint drops the flag entirely once
          // it is set (`fixedPositionId ? {id} : {showOnApplicationForm}`).
          // Offering only flagged rows here would hide exactly the position an
          // association wants to pin precisely because it is not on offer.
          //
          // The filter matches resolveApplicantPositionId(), which accepts any
          // non-DELETED position of this business - so nothing offered here
          // can be stored and then silently ignored at read time.
          where: owned,
          select: { id: true, positionName: true, positionNameTamil: true },
          orderBy: { positionName: 'asc' },
        });
        return rows.map((row) => ({
          id: row.id,
          label: row.positionName,
          labelTamil: row.positionNameTamil,
        }));
      }
      default:
        return [];
    }
  }

  async listRefOptionsForTenantUser(
    tenantUserId: string,
    ref: string,
    parentId?: string,
  ): Promise<RefOption[]> {
    return this.listRefOptions(ref, await this.getMyBusinessId(tenantUserId), parentId);
  }

  private async assertBusinessMapped(
    tenantUserId: string,
    tenantBusinessId: string,
  ): Promise<string> {
    const mapping = await this.prisma.tenantMappedBusiness.findFirst({
      where: { tenantUserId, tenantBusinessId, status: 'ACTIVE' },
    });
    if (!mapping) throw new ForbiddenException('That business is not mapped to your account');
    return tenantBusinessId;
  }

  private async getMyBusinessId(tenantUserId: string): Promise<string> {
    const mapping = await this.prisma.tenantMappedBusiness.findFirst({
      where: { tenantUserId, status: 'ACTIVE' },
    });
    if (!mapping) throw new NotFoundException('No business mapped to this account');
    return mapping.tenantBusinessId;
  }
}
