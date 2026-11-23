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
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TenantRtosService } from './tenant-rtos.service';
import { CreateTenantRtoDto, UpdateTenantRtoDto } from './dto/tenant-rto.dto';
import { TenantRtoListQueryDto } from './dto/tenant-rto-query.dto';
import { RTO_EXAMPLE } from './tenant-rtos.controller';
import { Public } from '../common/decorators/public.decorator';
import { RequireTenantPermissions } from '../common/decorators/require-tenant-permissions.decorator';
import {
  CurrentTenantUser,
  TenantAuthUser,
} from '../common/decorators/current-tenant-user.decorator';
import { TenantJwtAuthGuard } from '../common/guards/tenant-jwt-auth.guard';
import { TenantPermissionsGuard } from '../common/guards/tenant-permissions.guard';

// @Public() escapes the SYSTEM JWT guard so the tenant guard pair below can
// take over. It does NOT make the route public: an API key is still required,
// and TenantJwtAuthGuard still demands a tenant session.
@ApiTags('Tenant / RTOs')
@ApiBearerAuth()
@Public()
@UseGuards(TenantJwtAuthGuard, TenantPermissionsGuard)
@Controller('tenant/rtos')
export class TenantRtosSelfController {
  constructor(private readonly service: TenantRtosService) {}

  // Both literal routes are declared BEFORE @Get(':id'), or the param route
  // matches "businesses" and "districts" instead.
  @Get('businesses')
  @RequireTenantPermissions('tenant-rtos:list')
  @ApiOperation({
    summary: 'The businesses the caller may file RTOs under',
    description:
      'Powers the business picker. A caller mapped to a single business gets ' +
      'one row, and the screen selects it automatically.',
  })
  @ApiResponse({ status: 200, description: 'Mapped businesses.' })
  listBusinesses(@CurrentTenantUser() user: TenantAuthUser) {
    return this.service.listMappedBusinesses(user.id);
  }

  @Get('districts')
  @RequireTenantPermissions('tenant-rtos:list')
  @ApiOperation({
    summary: 'Options for the district picker',
    description: 'A bare array, not a paginated envelope - it fills a dropdown.',
  })
  @ApiQuery({ name: 'tenantBusinessId', required: true })
  @ApiResponse({ status: 200, description: 'District options.' })
  listDistricts(
    @CurrentTenantUser() user: TenantAuthUser,
    @Query('tenantBusinessId') tenantBusinessId: string,
  ) {
    return this.service.listDistrictsForTenantUser(user.id, tenantBusinessId);
  }

  @Get()
  @RequireTenantPermissions('tenant-rtos:list')
  @ApiOperation({
    summary: "List the caller's own RTOs",
    description:
      'Scoped to the businesses mapped to the caller. A tenantBusinessId in ' +
      'the query is intersected with that set, never trusted.',
  })
  @ApiResponse({ status: 200, description: 'Paginated RTO list.' })
  findAll(
    @CurrentTenantUser() user: TenantAuthUser,
    @Query() query: TenantRtoListQueryDto,
  ) {
    return this.service.findAllForTenantUser(user.id, query);
  }

  @Get(':id')
  @RequireTenantPermissions('tenant-rtos:view')
  @ApiOperation({ summary: "Get one of the caller's own RTOs" })
  @ApiParam({ name: 'id', description: 'RTO UUIDv7' })
  @ApiResponse({ status: 200, description: 'RTO detail.', schema: { example: RTO_EXAMPLE } })
  findOne(@CurrentTenantUser() user: TenantAuthUser, @Param('id') id: string) {
    return this.service.findOneForTenantUser(user.id, id);
  }

  @Post()
  @RequireTenantPermissions('tenant-rtos:create')
  @ApiOperation({ summary: "Create an RTO for one of the caller's businesses" })
  @ApiResponse({ status: 201, description: 'RTO created.', schema: { example: RTO_EXAMPLE } })
  @ApiResponse({ status: 403, description: 'You are not mapped to this business.' })
  create(
    @CurrentTenantUser() user: TenantAuthUser,
    @Body() dto: CreateTenantRtoDto,
  ) {
    return this.service.createForTenantUser(user.id, dto);
  }

  @Patch(':id')
  @RequireTenantPermissions('tenant-rtos:update')
  @ApiOperation({ summary: "Update one of the caller's own RTOs" })
  @ApiParam({ name: 'id', description: 'RTO UUIDv7' })
  @ApiResponse({ status: 200, description: 'RTO updated.', schema: { example: RTO_EXAMPLE } })
  update(
    @CurrentTenantUser() user: TenantAuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateTenantRtoDto,
  ) {
    return this.service.updateForTenantUser(user.id, id, dto);
  }

  // No restore route: restoring is a system-admin act, and the tenant
  // permission set deliberately omits the :restore key.
  @Delete(':id')
  @RequireTenantPermissions('tenant-rtos:delete')
  @ApiOperation({ summary: "Soft-delete one of the caller's own RTOs" })
  @ApiParam({ name: 'id', description: 'RTO UUIDv7' })
  @ApiResponse({ status: 200, description: 'RTO deleted.', schema: { example: { success: true } } })
  remove(@CurrentTenantUser() user: TenantAuthUser, @Param('id') id: string) {
    return this.service.removeForTenantUser(user.id, id);
  }
}
