import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TenantIdCardTemplatesService } from './tenant-id-card-templates.service';
import {
  CreateIdCardTemplateDto,
  UpdateIdCardTemplateDto,
} from './dto/id-card-template.dto';
import { IdCardTemplateListQueryDto } from './dto/id-card-template-query.dto';
import { TEMPLATE_EXAMPLE } from './tenant-id-card-templates.controller';
import { Public } from '../common/decorators/public.decorator';
import { RequireTenantPermissions } from '../common/decorators/require-tenant-permissions.decorator';
import {
  CurrentTenantUser,
  TenantAuthUser,
} from '../common/decorators/current-tenant-user.decorator';
import { TenantJwtAuthGuard } from '../common/guards/tenant-jwt-auth.guard';
import { TenantPermissionsGuard } from '../common/guards/tenant-permissions.guard';
import { ID_CARD_FIELDS } from '../tenant-id-cards/id-card-fields';

// @Public() escapes the SYSTEM JWT guard so the tenant guard pair below can
// take over. It does NOT make the route public: an API key is still required,
// and TenantJwtAuthGuard still demands a tenant session.
@ApiTags('Tenant / ID Card Templates')
@ApiBearerAuth()
@Public()
@UseGuards(TenantJwtAuthGuard, TenantPermissionsGuard)
@Controller('tenant/id-card-templates')
export class TenantIdCardTemplatesSelfController {
  constructor(private readonly service: TenantIdCardTemplatesService) {}

  // All three literal routes are declared BEFORE @Get(':id'), or the param
  // route matches "fields" and "businesses" instead.
  @Get('fields')
  @RequireTenantPermissions('tenant-id-card-templates:view')
  @ApiOperation({
    summary: 'The values a template may bind to',
    description:
      'Drives the designer palette. A template stores a TOKEN and never a ' +
      'value, and this is the one place that says which tokens exist. Each ' +
      'field carries a `sample`, so the canvas can show realistic widths ' +
      'instead of the token text.',
  })
  @ApiResponse({ status: 200, description: 'Field catalogue.' })
  listFields() {
    return ID_CARD_FIELDS;
  }

  @Get('businesses')
  @RequireTenantPermissions('tenant-id-card-templates:list')
  @ApiOperation({
    summary: 'The businesses the caller may design cards for',
    description:
      'Powers the business picker. A caller mapped to a single business gets ' +
      'one row, and the screen selects it automatically.',
  })
  @ApiResponse({ status: 200, description: 'Mapped businesses.' })
  listBusinesses(@CurrentTenantUser() user: TenantAuthUser) {
    return this.service.listMappedBusinesses(user.id);
  }

  @Get()
  @RequireTenantPermissions('tenant-id-card-templates:list')
  @ApiOperation({ summary: "List the caller's own templates" })
  @ApiResponse({ status: 200, description: 'Paginated templates.' })
  findAll(
    @CurrentTenantUser() user: TenantAuthUser,
    @Query() query: IdCardTemplateListQueryDto,
  ) {
    return this.service.findAllForTenantUser(user.id, query);
  }

  @Get(':id')
  @RequireTenantPermissions('tenant-id-card-templates:view')
  @ApiOperation({ summary: "Get one of the caller's own templates" })
  @ApiParam({ name: 'id', description: 'Template UUIDv7' })
  @ApiResponse({ status: 200, description: 'Template detail.', schema: { example: TEMPLATE_EXAMPLE } })
  findOne(@CurrentTenantUser() user: TenantAuthUser, @Param('id') id: string) {
    return this.service.findOneForTenantUser(user.id, id);
  }

  @Post()
  @RequireTenantPermissions('tenant-id-card-templates:create')
  @ApiOperation({
    summary: 'Create a template',
    description:
      'Omit `layout` to start from an empty card. The first template a ' +
      'business creates becomes its default.',
  })
  @ApiResponse({ status: 201, description: 'Template created.', schema: { example: TEMPLATE_EXAMPLE } })
  create(
    @CurrentTenantUser() user: TenantAuthUser,
    @Body() dto: CreateIdCardTemplateDto,
  ) {
    return this.service.createForTenantUser(user.id, dto);
  }

  @Patch(':id')
  @RequireTenantPermissions('tenant-id-card-templates:update')
  @ApiOperation({
    summary: 'Save a design',
    description: 'The whole `layout` is replaced rather than merged.',
  })
  @ApiParam({ name: 'id', description: 'Template UUIDv7' })
  @ApiResponse({ status: 200, description: 'Saved.', schema: { example: TEMPLATE_EXAMPLE } })
  @ApiResponse({ status: 400, description: 'The layout did not validate.' })
  update(
    @CurrentTenantUser() user: TenantAuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateIdCardTemplateDto,
  ) {
    return this.service.updateForTenantUser(user.id, id, dto);
  }

  @Patch(':id/default')
  @RequireTenantPermissions('tenant-id-card-templates:update')
  @ApiOperation({
    summary: 'Make this the business default',
    description: 'Clears the flag on whichever template held it, atomically.',
  })
  @ApiParam({ name: 'id', description: 'Template UUIDv7' })
  @ApiResponse({ status: 200, description: 'Default set.', schema: { example: TEMPLATE_EXAMPLE } })
  setDefault(@CurrentTenantUser() user: TenantAuthUser, @Param('id') id: string) {
    return this.service.setDefaultForTenantUser(user.id, id);
  }

  // No restore route: restoring is a system-admin act, and the tenant
  // permission set deliberately omits the :restore key.
  @Delete(':id')
  @RequireTenantPermissions('tenant-id-card-templates:delete')
  @ApiOperation({ summary: "Soft-delete one of the caller's own templates" })
  @ApiParam({ name: 'id', description: 'Template UUIDv7' })
  @ApiResponse({ status: 200, description: 'Deleted.', schema: { example: { success: true } } })
  remove(@CurrentTenantUser() user: TenantAuthUser, @Param('id') id: string) {
    return this.service.removeForTenantUser(user.id, id);
  }
}
