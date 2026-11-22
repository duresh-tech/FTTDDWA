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
import { TenantIndustriesService } from './tenant-industries.service';
import { CreateTenantIndustryDto, UpdateTenantIndustryDto } from './dto/tenant-industry.dto';
import { TenantIndustryListQueryDto } from './dto/tenant-industry-query.dto';
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
  systemCode: 'IND-MR8NZ6OO-0-C0CB',
  tenantBusinessId: '019f357b-c211-71a0-9062-adc0f927a584',
  industryName: 'Tent & Decoration',
  industryNameTamil: 'கூடாரம் & அலங்காரம்',
  status: 'ACTIVE',
  createdAt: 1783308735,
  updatedAt: 1783308735,
  deletedAt: null,
};

// @Public() escapes the SYSTEM JWT guard so the tenant guard pair below can
// take over. It does NOT make the route public: an API key is still required,
// and TenantJwtAuthGuard still demands a tenant session.
@ApiTags('Tenant / Industries')
@ApiBearerAuth()
@Public()
@UseGuards(TenantJwtAuthGuard, TenantPermissionsGuard)
@Controller('tenant/industries')
export class TenantIndustriesSelfController {
  constructor(private readonly service: TenantIndustriesService) {}

  // Literal paths are declared BEFORE @Get(':id'), or the param route matches
  // them and tries to look them up as ids.
  @Get('businesses')
  @RequireTenantPermissions('tenant-industries:list')
  @ApiOperation({
    summary: 'The businesses the caller may file industries under',
    description:
      'Powers the business picker. A caller mapped to a single business gets ' +
      'one row, and the screen selects it automatically.',
  })
  @ApiResponse({ status: 200, description: 'Mapped businesses.' })
  listBusinesses(@CurrentTenantUser() user: TenantAuthUser) {
    return this.service.listMappedBusinesses(user.id);
  }

  @Get()
  @RequireTenantPermissions('tenant-industries:list')
  @ApiOperation({
    summary: "List the caller's own industries",
    description:
      'Scoped to the businesses mapped to the caller. A tenantBusinessId in ' +
      'the query is intersected with that set, never trusted.',
  })
  @ApiResponse({ status: 200, description: 'Paginated list.' })
  findAll(
    @CurrentTenantUser() user: TenantAuthUser,
    @Query() query: TenantIndustryListQueryDto,
  ) {
    return this.service.findAllForTenantUser(user.id, query);
  }

  @Get(':id')
  @RequireTenantPermissions('tenant-industries:view')
  @ApiOperation({ summary: "Get one of the caller's own industries" })
  @ApiParam({ name: 'id', description: 'Industry UUIDv7' })
  @ApiResponse({ status: 200, description: 'Detail.', schema: { example: EXAMPLE } })
  @ApiResponse({ status: 404, description: 'Industry not found.' })
  findOne(@CurrentTenantUser() user: TenantAuthUser, @Param('id') id: string) {
    return this.service.findOneForTenantUser(user.id, id);
  }

  @Post()
  @RequireTenantPermissions('tenant-industries:create')
  @ApiOperation({ summary: "Create a industry for one of the caller's businesses" })
  @ApiResponse({ status: 201, description: 'Created.', schema: { example: EXAMPLE } })
  @ApiResponse({ status: 403, description: 'You are not mapped to this business.' })
  create(
    @CurrentTenantUser() user: TenantAuthUser,
    @Body() dto: CreateTenantIndustryDto,
  ) {
    return this.service.createForTenantUser(user.id, dto);
  }

  @Patch(':id')
  @RequireTenantPermissions('tenant-industries:update')
  @ApiOperation({ summary: "Update one of the caller's own industries" })
  @ApiParam({ name: 'id', description: 'Industry UUIDv7' })
  @ApiResponse({ status: 200, description: 'Updated.', schema: { example: EXAMPLE } })
  @ApiResponse({ status: 404, description: 'Industry not found.' })
  update(
    @CurrentTenantUser() user: TenantAuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateTenantIndustryDto,
  ) {
    return this.service.updateForTenantUser(user.id, id, dto);
  }

  // No restore route: restoring is a system-admin act, and the tenant
  // permission set deliberately omits the :restore key.
  @Delete(':id')
  @RequireTenantPermissions('tenant-industries:delete')
  @ApiOperation({ summary: "Soft-delete one of the caller's own industries" })
  @ApiParam({ name: 'id', description: 'Industry UUIDv7' })
  @ApiResponse({ status: 200, description: 'Deleted.', schema: { example: { success: true } } })
  @ApiResponse({ status: 404, description: 'Industry not found.' })
  remove(@CurrentTenantUser() user: TenantAuthUser, @Param('id') id: string) {
    return this.service.removeForTenantUser(user.id, id);
  }
}
