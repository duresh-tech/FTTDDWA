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
import { TenantIndustriesService } from './tenant-industries.service';
import { CreateTenantIndustryDto, UpdateTenantIndustryDto } from './dto/tenant-industry.dto';
import { TenantIndustryListQueryDto } from './dto/tenant-industry-query.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

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

@ApiTags('System / Tenant Industries')
@ApiBearerAuth()
@Controller('system/tenant-industries')
export class TenantIndustriesController {
  constructor(private readonly service: TenantIndustriesService) {}

  @Get()
  @RequirePermissions('tenant-industries:list')
  @ApiOperation({
    summary: 'List industries',
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
  findAll(@Query() query: TenantIndustryListQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('tenant-industries:view')
  @ApiOperation({ summary: 'Get one industry' })
  @ApiParam({ name: 'id', description: 'Industry UUIDv7' })
  @ApiResponse({ status: 200, description: 'Detail.', schema: { example: EXAMPLE } })
  @ApiResponse({ status: 404, description: 'Industry not found.' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions('tenant-industries:create')
  @ApiOperation({
    summary: 'Create a industry',
    description: 'industryNameTamil is optional - may be recorded in English only.',
  })
  @ApiResponse({ status: 201, description: 'Created.', schema: { example: EXAMPLE } })
  @ApiResponse({ status: 400, description: 'Tenant business does not exist, or a validation rule failed.' })
  create(@Body() dto: CreateTenantIndustryDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('tenant-industries:update')
  @ApiOperation({
    summary: 'Update a industry',
    description: 'status cannot be set to DELETED here - use DELETE, which soft-deletes.',
  })
  @ApiParam({ name: 'id', description: 'Industry UUIDv7' })
  @ApiResponse({ status: 200, description: 'Updated.', schema: { example: EXAMPLE } })
  @ApiResponse({ status: 404, description: 'Industry not found.' })
  update(@Param('id') id: string, @Body() dto: UpdateTenantIndustryDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('tenant-industries:delete')
  @ApiOperation({
    summary: 'Soft-delete a industry',
    description: 'Sets status=DELETED and stamps deletedAt. The row is never removed.',
  })
  @ApiParam({ name: 'id', description: 'Industry UUIDv7' })
  @ApiResponse({ status: 200, description: 'Deleted.', schema: { example: { success: true } } })
  @ApiResponse({ status: 404, description: 'Industry not found.' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Patch(':id/restore')
  @RequirePermissions('tenant-industries:restore')
  @ApiOperation({
    summary: 'Restore a soft-deleted industry',
    description: 'System-admin only - the tenant surface has no restore route.',
  })
  @ApiParam({ name: 'id', description: 'Industry UUIDv7' })
  @ApiResponse({ status: 200, description: 'Restored.', schema: { example: EXAMPLE } })
  @ApiResponse({ status: 404, description: 'Industry not found or not deleted.' })
  restore(@Param('id') id: string) {
    return this.service.restore(id);
  }
}
