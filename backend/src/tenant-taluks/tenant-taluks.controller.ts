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
import { TenantTaluksService } from './tenant-taluks.service';
import { CreateTenantTalukDto, UpdateTenantTalukDto } from './dto/tenant-taluk.dto';
import { TenantTalukListQueryDto } from './dto/tenant-taluk-query.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

const EXAMPLE = {
  id: '019f357b-d398-73aa-9062-adc0f927a584',
  systemCode: 'TLK-MR8NZ6OO-0-C0CB',
  tenantBusinessId: '019f357b-c211-71a0-9062-adc0f927a584',
  stateId: '019f357b-aa11-71a0-9062-adc0f927a584',
  districtId: '019f357b-aa11-71a0-9062-adc0f927a584',
  talukName: 'Melur',
  talukNameTamil: 'மேலூர்',
  status: 'ACTIVE',
  createdAt: 1783308735,
  updatedAt: 1783308735,
  deletedAt: null,
};

@ApiTags('System / Tenant Taluks')
@ApiBearerAuth()
@Controller('system/tenant-taluks')
export class TenantTaluksController {
  constructor(private readonly service: TenantTaluksService) {}

  @Get('states')
  @RequirePermissions('tenant-taluks:list')
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

  @Get('districts')
  @RequirePermissions('tenant-taluks:list')
  @ApiOperation({
    summary: 'Options for the district picker',
    description: 'A bare array, not a paginated envelope - it fills a dropdown.',
  })
  @ApiQuery({ name: 'tenantBusinessId', required: true })
  @ApiQuery({ name: 'stateId', required: false, description: 'Narrows the list to one state.' })
  @ApiResponse({ status: 200, description: 'District options.' })
  listDistricts(
    @Query('tenantBusinessId') tenantBusinessId: string,
    @Query('stateId') stateId?: string,
  ) {
    return this.service.listDistricts(tenantBusinessId, stateId);
  }

  @Get()
  @RequirePermissions('tenant-taluks:list')
  @ApiOperation({
    summary: 'List taluks',
    description:
      'Paginated, searchable, filterable, sortable list across every business. ' +
      'Search matches the English name, the Tamil name or the system code. ' +
      'Excludes deleted rows unless status=DELETED is requested.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list.',
    schema: { example: { items: [EXAMPLE], meta: { total: 1, page: 1, limit: 20, totalPages: 1 } } },
  })
  findAll(@Query() query: TenantTalukListQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('tenant-taluks:view')
  @ApiOperation({ summary: 'Get one taluk' })
  @ApiParam({ name: 'id', description: 'Taluk UUIDv7' })
  @ApiResponse({ status: 200, description: 'Detail.', schema: { example: EXAMPLE } })
  @ApiResponse({ status: 404, description: 'Taluk not found.' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions('tenant-taluks:create')
  @ApiOperation({
    summary: 'Create a taluk',
    description: 'talukNameTamil is optional - may be recorded in English only.',
  })
  @ApiResponse({ status: 201, description: 'Created.', schema: { example: EXAMPLE } })
  @ApiResponse({ status: 400, description: 'Tenant business does not exist, or a validation rule failed.' })
  create(@Body() dto: CreateTenantTalukDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('tenant-taluks:update')
  @ApiOperation({
    summary: 'Update a taluk',
    description: 'status cannot be set to DELETED here - use DELETE, which soft-deletes.',
  })
  @ApiParam({ name: 'id', description: 'Taluk UUIDv7' })
  @ApiResponse({ status: 200, description: 'Updated.', schema: { example: EXAMPLE } })
  @ApiResponse({ status: 404, description: 'Taluk not found.' })
  update(@Param('id') id: string, @Body() dto: UpdateTenantTalukDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('tenant-taluks:delete')
  @ApiOperation({
    summary: 'Soft-delete a taluk',
    description: 'Sets status=DELETED and stamps deletedAt. The row is never removed.',
  })
  @ApiParam({ name: 'id', description: 'Taluk UUIDv7' })
  @ApiResponse({ status: 200, description: 'Deleted.', schema: { example: { success: true } } })
  @ApiResponse({ status: 404, description: 'Taluk not found.' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Patch(':id/restore')
  @RequirePermissions('tenant-taluks:restore')
  @ApiOperation({
    summary: 'Restore a soft-deleted taluk',
    description: 'System-admin only - the tenant surface has no restore route.',
  })
  @ApiParam({ name: 'id', description: 'Taluk UUIDv7' })
  @ApiResponse({ status: 200, description: 'Restored.', schema: { example: EXAMPLE } })
  @ApiResponse({ status: 404, description: 'Taluk not found or not deleted.' })
  restore(@Param('id') id: string) {
    return this.service.restore(id);
  }
}
