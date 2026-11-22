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
import { TenantAssociationPositionsService } from './tenant-association-positions.service';
import {
  CreateTenantAssociationPositionDto,
  UpdateTenantAssociationPositionDto,
} from './dto/tenant-association-position.dto';
import { TenantAssociationPositionListQueryDto } from './dto/tenant-association-position-query.dto';
import { Public } from '../common/decorators/public.decorator';
import { RequireTenantPermissions } from '../common/decorators/require-tenant-permissions.decorator';
import {
  CurrentTenantUser,
  TenantAuthUser,
} from '../common/decorators/current-tenant-user.decorator';
import { TenantJwtAuthGuard } from '../common/guards/tenant-jwt-auth.guard';
import { TenantPermissionsGuard } from '../common/guards/tenant-permissions.guard';

const ASSOCIATION_POSITION_EXAMPLE = {
  id: '019f357b-d398-73aa-9062-adc0f927a584',
  systemCode: 'TAP-MR8NZ6OO-0-C0CB',
  tenantBusinessId: '019f357b-c211-71a0-9062-adc0f927a584',
  positionName: 'Secretary',
  positionNameTamil: 'செயலாளர்',
  remark: 'Elected for a two-year term',
  status: 'ACTIVE',
  createdAt: 1783308735,
  updatedAt: 1783308735,
  deletedAt: null,
  tenantBusiness: {
    id: '019f357b-c211-71a0-9062-adc0f927a584',
    systemCode: 'TNB-MR8NZ6OO-C0CB',
    name: 'Acme Retail Pvt Ltd',
  },
};

// @Public() escapes the SYSTEM JWT guard so the tenant guard pair below can
// take over. It does NOT make the route public: an API key is still required,
// and TenantJwtAuthGuard still demands a tenant session.
@ApiTags('Tenant / Association Positions')
@ApiBearerAuth()
@Public()
@UseGuards(TenantJwtAuthGuard, TenantPermissionsGuard)
@Controller('tenant/association-positions')
export class TenantAssociationPositionsSelfController {
  constructor(
    private readonly tenantAssociationPositionsService: TenantAssociationPositionsService,
  ) {}

  // Declared BEFORE @Get(':id') on purpose - the param route would otherwise
  // match "businesses" and try to look it up as an id.
  @Get('businesses')
  @RequireTenantPermissions('tenant-association-positions:list')
  @ApiOperation({
    summary: "The businesses the caller may file positions under",
    description:
      'Powers the business picker on the create form. A caller mapped to a ' +
      'single business gets one row, and the screen selects it automatically.',
  })
  @ApiResponse({
    status: 200,
    description: 'Mapped businesses.',
    schema: {
      example: [{ id: '019f357b-c211-71a0-9062-adc0f927a584', name: 'Acme Retail Pvt Ltd' }],
    },
  })
  listBusinesses(@CurrentTenantUser() user: TenantAuthUser) {
    return this.tenantAssociationPositionsService.listMappedBusinesses(user.id);
  }

  @Get()
  @RequireTenantPermissions('tenant-association-positions:list')
  @ApiOperation({
    summary: "List the caller's own association positions",
    description:
      "Scoped to the businesses mapped to the caller. A tenantBusinessId in the " +
      'query is intersected with that set, never trusted. Search matches the ' +
      'English name, the Tamil name or the system code.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated association position list.',
    schema: {
      example: {
        items: [ASSOCIATION_POSITION_EXAMPLE],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      },
    },
  })
  findAll(
    @CurrentTenantUser() user: TenantAuthUser,
    @Query() query: TenantAssociationPositionListQueryDto,
  ) {
    return this.tenantAssociationPositionsService.findAllForTenantUser(user.id, query);
  }

  @Get(':id')
  @RequireTenantPermissions('tenant-association-positions:view')
  @ApiOperation({ summary: 'Get one of the caller\'s own association positions' })
  @ApiParam({ name: 'id', description: 'Association position UUIDv7' })
  @ApiResponse({
    status: 200,
    description: 'Association position detail.',
    schema: { example: ASSOCIATION_POSITION_EXAMPLE },
  })
  @ApiResponse({ status: 404, description: 'Association position not found.' })
  findOne(@CurrentTenantUser() user: TenantAuthUser, @Param('id') id: string) {
    return this.tenantAssociationPositionsService.findOneForTenantUser(user.id, id);
  }

  @Post()
  @RequireTenantPermissions('tenant-association-positions:create')
  @ApiOperation({
    summary: 'Create an association position for one of the caller\'s businesses',
    description: 'positionNameTamil is optional - a position may be recorded in English only.',
  })
  @ApiResponse({
    status: 201,
    description: 'Association position created.',
    schema: { example: ASSOCIATION_POSITION_EXAMPLE },
  })
  @ApiResponse({ status: 403, description: 'You are not mapped to this business.' })
  create(
    @CurrentTenantUser() user: TenantAuthUser,
    @Body() dto: CreateTenantAssociationPositionDto,
  ) {
    return this.tenantAssociationPositionsService.createForTenantUser(user.id, dto);
  }

  @Patch(':id')
  @RequireTenantPermissions('tenant-association-positions:update')
  @ApiOperation({
    summary: 'Update one of the caller\'s own association positions',
    description: 'status cannot be set to DELETED here - use DELETE, which soft-deletes.',
  })
  @ApiParam({ name: 'id', description: 'Association position UUIDv7' })
  @ApiResponse({
    status: 200,
    description: 'Association position updated.',
    schema: { example: ASSOCIATION_POSITION_EXAMPLE },
  })
  @ApiResponse({ status: 403, description: 'You are not mapped to this business.' })
  @ApiResponse({ status: 404, description: 'Association position not found.' })
  update(
    @CurrentTenantUser() user: TenantAuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateTenantAssociationPositionDto,
  ) {
    return this.tenantAssociationPositionsService.updateForTenantUser(user.id, id, dto);
  }

  // No restore route: restoring a soft-deleted row is a system-admin act, and
  // the tenant permission set deliberately omits the :restore key.
  @Delete(':id')
  @RequireTenantPermissions('tenant-association-positions:delete')
  @ApiOperation({
    summary: 'Soft-delete one of the caller\'s own association positions',
    description: 'Sets status=DELETED. Only a system admin can restore it afterwards.',
  })
  @ApiParam({ name: 'id', description: 'Association position UUIDv7' })
  @ApiResponse({
    status: 200,
    description: 'Association position deleted.',
    schema: { example: { success: true } },
  })
  @ApiResponse({ status: 404, description: 'Association position not found.' })
  remove(@CurrentTenantUser() user: TenantAuthUser, @Param('id') id: string) {
    return this.tenantAssociationPositionsService.removeForTenantUser(user.id, id);
  }
}
