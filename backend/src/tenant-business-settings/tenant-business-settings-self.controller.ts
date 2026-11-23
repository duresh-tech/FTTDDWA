import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TenantBusinessSettingsService } from './tenant-business-settings.service';
import { BatchUpdateTenantBusinessSettingDto } from './dto/tenant-business-setting.dto';
import { Public } from '../common/decorators/public.decorator';
import { RequireTenantPermissions } from '../common/decorators/require-tenant-permissions.decorator';
import {
  CurrentTenantUser,
  TenantAuthUser,
} from '../common/decorators/current-tenant-user.decorator';
import { TenantJwtAuthGuard } from '../common/guards/tenant-jwt-auth.guard';
import { TenantPermissionsGuard } from '../common/guards/tenant-permissions.guard';

const OWN_SETTING_EXAMPLE = {
  id: '019f357b-f2c4-73aa-9062-adc0f927a584',
  category: 'Association',
  subCategory: null,
  settingKey: 'association.shortName',
  settingLabel: 'Short name',
  description: 'The abbreviation used where the full name will not fit.',
  valueType: 'STRING',
  settingValue: 'FTTDDWA',
  validationRules: '{"maxLength":50}',
  isEncrypted: false,
  isReadonly: false,
  isVisible: true,
  sortOrder: 120,
  status: 'ACTIVE',
};

const REF_OPTION_EXAMPLE = {
  id: '019f357b-cc33-71a0-9062-adc0f927a584',
  label: 'Tamil Nadu',
  labelTamil: 'தமிழ்நாடு',
};

// @Public() escapes the SYSTEM JWT guard so the tenant guard pair below can
// take over. It does NOT make the route public: an API key is still required,
// and TenantJwtAuthGuard still demands a tenant session.
@ApiTags('Tenant / Business Settings')
@ApiBearerAuth()
@Public()
@UseGuards(TenantJwtAuthGuard, TenantPermissionsGuard)
@Controller('tenant/business-settings')
export class TenantBusinessSettingsSelfController {
  constructor(
    private readonly tenantBusinessSettingsService: TenantBusinessSettingsService,
  ) {}

  @Get()
  @RequireTenantPermissions('tenant-business-settings:view')
  @ApiOperation({
    summary: "List the authenticated tenant user's own business settings",
    description:
      'Returned in sortOrder; the settings screen groups them by category. ' +
      'Readonly settings are included and carry the flag, so the screen can ' +
      'show them without letting them be edited. Hidden settings (isVisible ' +
      'false) are also returned, because application code reads them - leaving ' +
      'them off the screen is the screen\'s job. Encrypted values read back as ' +
      'an empty string.',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    description:
      'Returns one category instead of all. Categories come from the seeded ' +
      'definitions rather than an enum, so a new one appears here with no code ' +
      'change. Seeded today: General, Tax, Association, Signatures, ' +
      'Member Register.',
  })
  @ApiQuery({
    name: 'tenantBusinessId',
    required: false,
    description:
      'Defaults to the business the caller is mapped to first. Pass it ' +
      'explicitly from a screen that manages more than one mapped business, so ' +
      'the settings read back match the business selected on screen rather ' +
      'than an arbitrary one. It is checked against the caller\'s mappings.',
  })
  @ApiResponse({
    status: 200,
    description: 'Own business settings.',
    schema: { example: [OWN_SETTING_EXAMPLE] },
  })
  @ApiResponse({ status: 403, description: 'That business is not mapped to your account.' })
  @ApiResponse({ status: 404, description: 'No business mapped to this account.' })
  findMine(
    @CurrentTenantUser() user: TenantAuthUser,
    @Query('category') category?: string,
    @Query('tenantBusinessId') tenantBusinessId?: string,
  ) {
    return this.tenantBusinessSettingsService.findAllForTenantUser(
      user.id,
      category,
      tenantBusinessId,
    );
  }

  // Guarded by this surface's OWN permission, deliberately. Borrowing
  // GET /tenant/districts/states would have cost nothing to write and would
  // have made editing an association's address require tenant-districts:list -
  // an unrelated permission a settings-only role has no reason to hold.
  @Get('options/:ref')
  @RequireTenantPermissions('tenant-business-settings:view')
  @ApiOperation({
    summary: 'Options for a setting that points at another resource',
    description:
      'A setting whose validationRules carry a `ref` holds another record\'s ' +
      'UUID in a plain string, and the screen renders a picker instead of a ' +
      'UUID box. A bare array, not a paginated envelope - it fills a dropdown. ' +
      'An unknown ref returns an empty array rather than an error, because ' +
      '`ref` is free text in the catalogue and a typo there must not break the ' +
      'settings screen.',
  })
  @ApiParam({ name: 'ref', description: 'The ref name, ex. "states"' })
  @ApiResponse({
    status: 200,
    description: 'Options, or [] for an unknown ref.',
    schema: { example: [REF_OPTION_EXAMPLE] },
  })
  @ApiResponse({ status: 404, description: 'No business mapped to this account.' })
  listRefOptions(@CurrentTenantUser() user: TenantAuthUser, @Param('ref') ref: string) {
    return this.tenantBusinessSettingsService.listRefOptionsForTenantUser(user.id, ref);
  }

  @Patch()
  @RequireTenantPermissions('tenant-business-settings:update')
  @ApiOperation({
    summary: 'Batch-update own business settings',
    description:
      'Saves a screenful as one unit: if any value is rejected, or any targeted ' +
      'setting is locked (isReadonly) for this business, the WHOLE batch rolls ' +
      'back. Half a saved form is worse than a refused one. A blank value ' +
      'CLEARS the setting - except on an encrypted one, where it means ' +
      '"unchanged", because the value reads back masked and cannot be retyped.',
  })
  @ApiResponse({
    status: 200,
    description: 'The settings as saved.',
    schema: { example: [OWN_SETTING_EXAMPLE] },
  })
  @ApiResponse({ status: 400, description: "A value was rejected by its setting's rules." })
  @ApiResponse({ status: 403, description: 'One of the settings is locked for this business.' })
  batchUpdate(
    @CurrentTenantUser() user: TenantAuthUser,
    @Body() dto: BatchUpdateTenantBusinessSettingDto,
  ) {
    return this.tenantBusinessSettingsService.batchUpdateForTenantUser(user.id, dto);
  }
}
