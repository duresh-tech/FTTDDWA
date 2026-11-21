import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TenantBusinessSettingsService } from './tenant-business-settings.service';
import { UpdateTenantBusinessSettingDto } from './dto/tenant-business-setting.dto';
import { TenantBusinessSettingListQueryDto } from './dto/tenant-business-setting-query.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

const TENANT_BUSINESS_SETTING_EXAMPLE = {
  id: '019f357b-f2c4-73aa-9062-adc0f927a584',
  systemCode: 'TBS-MWQNLU5O-1-9C21B8',
  tenantBusinessId: '019f357b-d398-73aa-9062-adc0f927a584',
  settingDefinitionId: '019f357b-e5b1-73aa-9062-adc0f927a584',
  category: 'Customers',
  subCategory: null,
  settingKey: 'customer.codeGeneration',
  settingLabel: 'Customer code generation',
  valueType: 'STRING',
  description: 'Whether customer codes are typed in or allocated automatically.',
  validationRules: '{"enum":["MANUAL","AUTOMATIC"]}',
  settingValue: 'MANUAL',
  isEncrypted: false,
  isReadonly: false,
  isVisible: true,
  sortOrder: 10,
  status: 'ACTIVE',
  createdAt: 1783308735,
  updatedAt: 1783308735,
  deletedAt: null,
};

@ApiTags('System / Tenant Business Settings')
@ApiBearerAuth()
@Controller('system/tenant-business-settings')
export class TenantBusinessSettingsController {
  constructor(
    private readonly tenantBusinessSettingsService: TenantBusinessSettingsService,
  ) {}

  @Get()
  @RequirePermissions('tenant-business-settings:list')
  @ApiOperation({
    summary: "Cross-tenant view of one business's settings",
    description:
      'Requires tenantBusinessId - settings are only meaningful one business at ' +
      'a time. Encrypted values are masked to an empty string; the ciphertext ' +
      'never leaves the server.',
  })
  @ApiResponse({
    status: 200,
    description: "That business's settings.",
    schema: {
      example: {
        items: [TENANT_BUSINESS_SETTING_EXAMPLE],
        meta: { total: 8, page: 1, limit: 50, totalPages: 1 },
      },
    },
  })
  findAll(@Query() query: TenantBusinessSettingListQueryDto) {
    return this.tenantBusinessSettingsService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('tenant-business-settings:view')
  @ApiOperation({ summary: 'Get one tenant business setting by id' })
  @ApiParam({ name: 'id', description: 'Tenant business setting UUIDv7' })
  @ApiResponse({
    status: 200,
    description: 'Setting detail.',
    schema: { example: TENANT_BUSINESS_SETTING_EXAMPLE },
  })
  @ApiResponse({ status: 404, description: 'Setting not found.' })
  findOne(@Param('id') id: string) {
    return this.tenantBusinessSettingsService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('tenant-business-settings:update')
  @ApiOperation({
    summary: 'Update a setting value, or lock/unlock it for this tenant',
    description:
      'isReadonly here overrides the definition default for this ONE business, ' +
      "independent of every other tenant's copy of the same setting - so one " +
      'business can be prevented from changing a value while the rest still ' +
      'can. On an encrypted setting, a blank settingValue means "unchanged", ' +
      'never "clear it".',
  })
  @ApiParam({ name: 'id', description: 'Tenant business setting UUIDv7' })
  @ApiResponse({
    status: 200,
    description: 'Setting updated.',
    schema: { example: TENANT_BUSINESS_SETTING_EXAMPLE },
  })
  @ApiResponse({ status: 400, description: 'Value rejected by the setting\'s own rules.' })
  @ApiResponse({ status: 404, description: 'Setting not found.' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTenantBusinessSettingDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tenantBusinessSettingsService.update(id, dto, user.id);
  }
}
