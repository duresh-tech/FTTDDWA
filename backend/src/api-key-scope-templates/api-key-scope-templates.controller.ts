import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { ApiKeyScopeTemplatesService } from './api-key-scope-templates.service';
import {
  CreateTemplateDto,
  TemplateListQueryDto,
  UpdateTemplateDto,
} from './dto/api-key-scope-template.dto';

const TEMPLATE_EXAMPLE = {
  id: '019f357b-e5b1-73aa-9062-adc0f927a584',
  systemCode: 'AKT-MBX2K1-4F7A',
  name: 'Reporting client',
  description: 'Read-only access to places and streets',
  isTenant: true,
  displayOrder: 10,
  status: 'ACTIVE',
  scopes: ['tenant-members:list', 'tenant-members:view'],
};

/**
 * Named bundles of scopes for issuing API keys.
 *
 * Curated here only - tenants read them but cannot write them.
 * See docs/guide/api-keys.
 */
@ApiTags('System / API Key Scope Templates')
@ApiBearerAuth()
@Controller('system/api-key-scope-templates')
export class ApiKeyScopeTemplatesController {
  constructor(private readonly templates: ApiKeyScopeTemplatesService) {}

  @Get()
  @RequirePermissions('api-key-scope-templates:list')
  @ApiOperation({ summary: 'List scope templates' })
  @ApiOkResponse({
    schema: {
      example: { items: [TEMPLATE_EXAMPLE], meta: { total: 1, page: 1, limit: 20, totalPages: 1 } },
    },
  })
  async findAll(@Query() query: TemplateListQueryDto) {
    return this.templates.findAll(query);
  }

  // Declared BEFORE @Get(':id') or the path parameter swallows it.
  @Get('permission-catalogue')
  @RequirePermissions('api-key-scope-templates:list')
  @ApiOperation({
    summary: 'Every permission, for the template picker',
    description:
      'Unpaged on purpose: the ordinary permission list caps at 100, and a ' +
      'truncated catalogue produces templates silently missing scopes.',
  })
  @ApiOkResponse({
    schema: {
      example: {
        items: [
          { permissionKey: 'tenant-members:list', moduleName: 'tenant-members', displayName: 'List Tenant Members' },
        ],
        total: 86,
      },
    },
  })
  async permissionCatalogue() {
    return this.templates.permissionCatalogue();
  }

  @Get(':id')
  @RequirePermissions('api-key-scope-templates:view')
  @ApiOperation({ summary: 'View a scope template' })
  @ApiParam({ name: 'id', description: 'Template id (UUIDv7)' })
  @ApiOkResponse({ schema: { example: TEMPLATE_EXAMPLE } })
  async findOne(@Param('id') id: string) {
    return this.templates.findOne(id);
  }

  @Post()
  @RequirePermissions('api-key-scope-templates:create')
  @ApiOperation({ summary: 'Create a scope template' })
  @ApiResponse({ status: 201, schema: { example: TEMPLATE_EXAMPLE } })
  @ApiResponse({ status: 400, description: 'A scope names a permission that does not exist.' })
  @ApiResponse({ status: 409, description: 'A template with that name already exists.' })
  async create(@Body() dto: CreateTemplateDto) {
    return this.templates.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('api-key-scope-templates:update')
  @ApiOperation({
    summary: 'Update a scope template',
    description:
      'Keys already issued from this template keep their scopes - a template ' +
      'is a shortcut at creation time, not a live link.',
  })
  @ApiParam({ name: 'id', description: 'Template id (UUIDv7)' })
  @ApiOkResponse({ schema: { example: TEMPLATE_EXAMPLE } })
  async update(@Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    return this.templates.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('api-key-scope-templates:delete')
  @ApiOperation({ summary: 'Remove a scope template' })
  @ApiParam({ name: 'id', description: 'Template id (UUIDv7)' })
  @ApiOkResponse({ schema: { example: { success: true } } })
  async remove(@Param('id') id: string) {
    return this.templates.remove(id);
  }
}
