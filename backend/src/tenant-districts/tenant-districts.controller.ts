import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
import { RequirePermissions } from '../common/decorators/permissions.decorator';

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

@ApiTags('System / Tenant Districts')
@ApiBearerAuth()
@Controller('system/tenant-districts')
export class TenantDistrictsController {
  constructor(private readonly service: TenantDistrictsService) {}

  @Get('states')
  @RequirePermissions('tenant-districts:list')
  @ApiOperation({
    summary: 'Options for the state picker',
    description: 'A bare array, not a paginated envelope - it fills a dropdown.',
  })
  @ApiQuery({ name: 'tenantBusinessId', required: true })
  @ApiResponse({ status: 200, description: 'State options.' })
  listStates(
    @Query('tenantBusinessId') tenantBusinessId: string,
  ) {
    return this.service.listStates(tenantBusinessId);
  }

  @Get()
  @RequirePermissions('tenant-districts:list')
  @ApiOperation({
    summary: 'List districts',
    description:
      'Paginated, searchable, filterable, sortable list across every business. ' +
      'Search matches the English name, the Tamil name, the code or the system code. ' +
      'Excludes deleted rows unless status=DELETED is requested.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list.',
    schema: { example: { items: [EXAMPLE], meta: { total: 1, page: 1, limit: 20, totalPages: 1 } } },
  })
  findAll(@Query() query: TenantDistrictListQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('tenant-districts:view')
  @ApiOperation({ summary: 'Get one district' })
  @ApiParam({ name: 'id', description: 'District UUIDv7' })
  @ApiResponse({ status: 200, description: 'Detail.', schema: { example: EXAMPLE } })
  @ApiResponse({ status: 404, description: 'District not found.' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions('tenant-districts:create')
  @ApiOperation({
    summary: 'Create a district',
    description: 'districtNameTamil is optional - may be recorded in English only.',
  })
  @ApiResponse({ status: 201, description: 'Created.', schema: { example: EXAMPLE } })
  @ApiResponse({ status: 400, description: 'Duplicate code for this business, or the tenant business does not exist.' })
  create(@Body() dto: CreateTenantDistrictDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('tenant-districts:update')
  @ApiOperation({
    summary: 'Update a district',
    description: 'status cannot be set to DELETED here - use DELETE, which soft-deletes.',
  })
  @ApiParam({ name: 'id', description: 'District UUIDv7' })
  @ApiResponse({ status: 200, description: 'Updated.', schema: { example: EXAMPLE } })
  @ApiResponse({ status: 404, description: 'District not found.' })
  update(@Param('id') id: string, @Body() dto: UpdateTenantDistrictDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('tenant-districts:delete')
  @ApiOperation({
    summary: 'Soft-delete a district',
    description: 'Sets status=DELETED and stamps deletedAt. The row is never removed.',
  })
  @ApiParam({ name: 'id', description: 'District UUIDv7' })
  @ApiResponse({ status: 200, description: 'Deleted.', schema: { example: { success: true } } })
  @ApiResponse({ status: 404, description: 'District not found.' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Patch(':id/restore')
  @RequirePermissions('tenant-districts:restore')
  @ApiOperation({
    summary: 'Restore a soft-deleted district',
    description: 'System-admin only - the tenant surface has no restore route.',
  })
  @ApiParam({ name: 'id', description: 'District UUIDv7' })
  @ApiResponse({ status: 200, description: 'Restored.', schema: { example: EXAMPLE } })
  @ApiResponse({ status: 404, description: 'District not found or not deleted.' })
  restore(@Param('id') id: string) {
    return this.service.restore(id);
  }
}
