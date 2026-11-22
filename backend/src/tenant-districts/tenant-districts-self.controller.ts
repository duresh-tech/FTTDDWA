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
import { TenantDistrictsService } from './tenant-districts.service';
import { CreateTenantDistrictDto, UpdateTenantDistrictDto } from './dto/tenant-district.dto';
import { TenantDistrictListQueryDto } from './dto/tenant-district-query.dto';
import { Public } from '../common/decorators/public.decorator';
import { RequireTenantPermissions } from '../common/decorators/require-tenant-permissions.decorator';
import {
  CurrentTenantUser,
  TenantAuthUser,
} from '../common/decorators/current-tenant-user.decorator';
import { TenantJwtAuthGuard } from '../common/guards/tenant-jwt-auth.guard';
import { TenantPermissionsGuard } from '../common/guards/tenant-permissions.guard';

const EXAMPLE = {
  id: '019f357b-d398-73aa-9062-adc0f927a584',
  systemCode: 'DIS-MR8NZ6OO-0-C0CB',
  tenantBusinessId: '019f357b-c211-71a0-9062-adc0f927a584',
  stateId: '019f357b-aa11-71a0-9062-adc0f927a584',
  districtName: 'Madurai',
  districtNameTamil: 'மதுரை',
  districtCode: 'MDU',
  status: 'ACTIVE',
  createdAt: 1783308735,
  updatedAt: 1783308735,
  deletedAt: null,
};

// @Public() escapes the SYSTEM JWT guard so the tenant guard pair below can
// take over. It does NOT make the route public: an API key is still required,
// and TenantJwtAuthGuard still demands a tenant session.
@ApiTags('Tenant / Districts')
@ApiBearerAuth()
@Public()
@UseGuards(TenantJwtAuthGuard, TenantPermissionsGuard)
@Controller('tenant/districts')
export class TenantDistrictsSelfController {
  constructor(private readonly service: TenantDistrictsService) {}

  // Literal paths are declared BEFORE @Get(':id'), or the param route matches
  // them and tries to look them up as ids.
  @Get('businesses')
  @RequireTenantPermissions('tenant-districts:list')
  @ApiOperation({
    summary: 'The businesses the caller may file districts under',
    description:
      'Powers the business picker. A caller mapped to a single business gets ' +
      'one row, and the screen selects it automatically.',
  })
  @ApiResponse({ status: 200, description: 'Mapped businesses.' })
  listBusinesses(@CurrentTenantUser() user: TenantAuthUser) {
    return this.service.listMappedBusinesses(user.id);
  }

  @Get('states')
  @RequireTenantPermissions('tenant-districts:list')
  @ApiOperation({
    summary: 'Options for the state picker',
    description: 'A bare array, not a paginated envelope - it fills a dropdown.',
  })
  @ApiQuery({ name: 'tenantBusinessId', required: true })
  @ApiResponse({ status: 200, description: 'State options.' })
  listStates(
    @CurrentTenantUser() user: TenantAuthUser,
    @Query('tenantBusinessId') tenantBusinessId: string,
  ) {
    return this.service.listStatesForTenantUser(user.id, tenantBusinessId);
  }

  @Get()
  @RequireTenantPermissions('tenant-districts:list')
  @ApiOperation({
    summary: "List the caller's own districts",
    description:
      'Scoped to the businesses mapped to the caller. A tenantBusinessId in ' +
      'the query is intersected with that set, never trusted.',
  })
  @ApiResponse({ status: 200, description: 'Paginated list.' })
  findAll(
    @CurrentTenantUser() user: TenantAuthUser,
    @Query() query: TenantDistrictListQueryDto,
  ) {
    return this.service.findAllForTenantUser(user.id, query);
  }

  @Get(':id')
  @RequireTenantPermissions('tenant-districts:view')
  @ApiOperation({ summary: "Get one of the caller's own districts" })
  @ApiParam({ name: 'id', description: 'District UUIDv7' })
  @ApiResponse({ status: 200, description: 'Detail.', schema: { example: EXAMPLE } })
  @ApiResponse({ status: 404, description: 'District not found.' })
  findOne(@CurrentTenantUser() user: TenantAuthUser, @Param('id') id: string) {
    return this.service.findOneForTenantUser(user.id, id);
  }

  @Post()
  @RequireTenantPermissions('tenant-districts:create')
  @ApiOperation({ summary: "Create a district for one of the caller's businesses" })
  @ApiResponse({ status: 201, description: 'Created.', schema: { example: EXAMPLE } })
  @ApiResponse({ status: 403, description: 'You are not mapped to this business.' })
  create(
    @CurrentTenantUser() user: TenantAuthUser,
    @Body() dto: CreateTenantDistrictDto,
  ) {
    return this.service.createForTenantUser(user.id, dto);
  }

  @Patch(':id')
  @RequireTenantPermissions('tenant-districts:update')
  @ApiOperation({ summary: "Update one of the caller's own districts" })
  @ApiParam({ name: 'id', description: 'District UUIDv7' })
  @ApiResponse({ status: 200, description: 'Updated.', schema: { example: EXAMPLE } })
  @ApiResponse({ status: 404, description: 'District not found.' })
  update(
    @CurrentTenantUser() user: TenantAuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateTenantDistrictDto,
  ) {
    return this.service.updateForTenantUser(user.id, id, dto);
  }

  // No restore route: restoring is a system-admin act, and the tenant
  // permission set deliberately omits the :restore key.
  @Delete(':id')
  @RequireTenantPermissions('tenant-districts:delete')
  @ApiOperation({ summary: "Soft-delete one of the caller's own districts" })
  @ApiParam({ name: 'id', description: 'District UUIDv7' })
  @ApiResponse({ status: 200, description: 'Deleted.', schema: { example: { success: true } } })
  @ApiResponse({ status: 404, description: 'District not found.' })
  remove(@CurrentTenantUser() user: TenantAuthUser, @Param('id') id: string) {
    return this.service.removeForTenantUser(user.id, id);
  }
}
