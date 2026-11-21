import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SettingDefinitionsService } from './setting-definitions.service';
import {
  CreateSettingDefinitionDto,
  UpdateSettingDefinitionDto,
} from './dto/setting-definition.dto';
import { SettingDefinitionListQueryDto } from './dto/setting-definition-query.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

const SETTING_DEFINITION_EXAMPLE = {
  id: '019f357b-e5b1-73aa-9062-adc0f927a584',
  systemCode: 'SDF-MWQNLU5O-0-47E246',
  category: 'Customers',
  subCategory: null,
  settingKey: 'customer.codeGeneration',
  settingLabel: 'Customer code generation',
  description: 'Whether customer codes are typed in or allocated automatically.',
  valueType: 'STRING',
  defaultValue: 'MANUAL',
  validationRules: '{"enum":["MANUAL","AUTOMATIC"]}',
  isRequired: true,
  isEncrypted: false,
  isReadonly: false,
  isVisible: true,
  autoSyncToExistingTenants: true,
  sortOrder: 10,
  status: 'ACTIVE',
  createdAt: 1783308735,
  updatedAt: 1783308735,
  deletedAt: null,
};

@ApiTags('System / Setting Definitions')
@ApiBearerAuth()
@Controller('system/setting-definitions')
export class SettingDefinitionsController {
  constructor(private readonly settingDefinitionsService: SettingDefinitionsService) {}

  @Get()
  @RequirePermissions('setting-definitions:list')
  @ApiOperation({
    summary: 'The catalogue of settings a business can hold',
    description:
      'These are definitions, not values. Each business holds its own copy of ' +
      'every ACTIVE definition - see System / Tenant Business Settings for the ' +
      'values themselves.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated definitions.',
    schema: {
      example: {
        items: [SETTING_DEFINITION_EXAMPLE],
        meta: { total: 8, page: 1, limit: 50, totalPages: 1 },
      },
    },
  })
  findAll(@Query() query: SettingDefinitionListQueryDto) {
    return this.settingDefinitionsService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('setting-definitions:view')
  @ApiOperation({ summary: 'Get one setting definition' })
  @ApiParam({ name: 'id', description: 'Setting definition UUIDv7' })
  @ApiResponse({
    status: 200,
    description: 'Definition detail.',
    schema: { example: SETTING_DEFINITION_EXAMPLE },
  })
  @ApiResponse({ status: 404, description: 'Setting definition not found.' })
  findOne(@Param('id') id: string) {
    return this.settingDefinitionsService.findOne(id);
  }

  @Post()
  @RequirePermissions('setting-definitions:create')
  @ApiOperation({
    summary: 'Define a new setting',
    description:
      'Reaches businesses created from now on automatically. Pass ' +
      'autoSyncToExistingTenants to also backfill the ones that already exist, ' +
      'which runs a full sync before returning. A validationRules `enum` makes ' +
      'the settings screen render a dropdown with no UI change.',
  })
  @ApiResponse({
    status: 201,
    description: 'Definition created.',
    schema: { example: SETTING_DEFINITION_EXAMPLE },
  })
  @ApiResponse({ status: 409, description: 'settingKey already exists.' })
  create(@Body() dto: CreateSettingDefinitionDto, @CurrentUser() user: AuthUser) {
    return this.settingDefinitionsService.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermissions('setting-definitions:update')
  @ApiOperation({
    summary: 'Update a setting definition',
    description:
      'settingKey and valueType cannot be changed: businesses hold copies keyed ' +
      'by the one and validated against the other, so editing either would ' +
      'orphan or silently re-type every existing row. Retire the definition ' +
      '(status INACTIVE) and add a new one instead. There is no delete, for the ' +
      'same reason. Turning autoSyncToExistingTenants on backfills immediately.',
  })
  @ApiParam({ name: 'id', description: 'Setting definition UUIDv7' })
  @ApiResponse({
    status: 200,
    description: 'Definition updated.',
    schema: { example: SETTING_DEFINITION_EXAMPLE },
  })
  @ApiResponse({ status: 404, description: 'Setting definition not found.' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSettingDefinitionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.settingDefinitionsService.update(id, dto, user.id);
  }
}
