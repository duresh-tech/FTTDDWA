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
import { TenantStatesService } from './tenant-states.service';
import { CreateTenantStateDto, UpdateTenantStateDto } from './dto/tenant-state.dto';
import { TenantStateListQueryDto } from './dto/tenant-state-query.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

const EXAMPLE = {
  id: '019f357b-d398-73aa-9062-adc0f927a584',
  systemCode: 'STA-MR8NZ6OO-0-C0CB',
  tenantBusinessId: '019f357b-c211-71a0-9062-adc0f927a584',
  stateName: 'Tamil Nadu',
  stateNameTamil: 'தமிழ்நாடு',
  stateCode: 'TN',
  countryId: '019f357b-d398-73aa-9062-adc0f927a111',
  country: { id: '019f357b-d398-73aa-9062-adc0f927a111', countryName: 'India', countryCode: 'IN', status: 'ACTIVE' },
  status: 'ACTIVE',
  createdAt: 1783308735,
  updatedAt: 1783308735,
  deletedAt: null,
};

@ApiTags('System / Tenant States')
@ApiBearerAuth()
@Controller('system/tenant-states')
export class TenantStatesController {
  constructor(private readonly service: TenantStatesService) {}

  @Get()
  @RequirePermissions('tenant-states:list')
  @ApiOperation({
    summary: 'List states',
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
  findAll(@Query() query: TenantStateListQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('tenant-states:view')
  @ApiOperation({ summary: 'Get one state' })
  @ApiParam({ name: 'id', description: 'State UUIDv7' })
  @ApiResponse({ status: 200, description: 'Detail.', schema: { example: EXAMPLE } })
  @ApiResponse({ status: 404, description: 'State not found.' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions('tenant-states:create')
  @ApiOperation({
    summary: 'Create a state',
    description: 'stateNameTamil is optional - may be recorded in English only.',
  })
  @ApiResponse({ status: 201, description: 'Created.', schema: { example: EXAMPLE } })
  @ApiResponse({ status: 400, description: 'Duplicate code for this business, or the tenant business does not exist.' })
  create(@Body() dto: CreateTenantStateDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('tenant-states:update')
  @ApiOperation({
    summary: 'Update a state',
    description: 'status cannot be set to DELETED here - use DELETE, which soft-deletes.',
  })
  @ApiParam({ name: 'id', description: 'State UUIDv7' })
  @ApiResponse({ status: 200, description: 'Updated.', schema: { example: EXAMPLE } })
  @ApiResponse({ status: 404, description: 'State not found.' })
  update(@Param('id') id: string, @Body() dto: UpdateTenantStateDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('tenant-states:delete')
  @ApiOperation({
    summary: 'Soft-delete a state',
    description: 'Sets status=DELETED and stamps deletedAt. The row is never removed.',
  })
  @ApiParam({ name: 'id', description: 'State UUIDv7' })
  @ApiResponse({ status: 200, description: 'Deleted.', schema: { example: { success: true } } })
  @ApiResponse({ status: 404, description: 'State not found.' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Patch(':id/restore')
  @RequirePermissions('tenant-states:restore')
  @ApiOperation({
    summary: 'Restore a soft-deleted state',
    description: 'System-admin only - the tenant surface has no restore route.',
  })
  @ApiParam({ name: 'id', description: 'State UUIDv7' })
  @ApiResponse({ status: 200, description: 'Restored.', schema: { example: EXAMPLE } })
  @ApiResponse({ status: 404, description: 'State not found or not deleted.' })
  restore(@Param('id') id: string) {
    return this.service.restore(id);
  }
}
