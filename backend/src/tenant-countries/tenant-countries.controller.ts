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
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TenantCountriesService } from './tenant-countries.service';
import { CreateTenantCountryDto, UpdateTenantCountryDto } from './dto/tenant-country.dto';
import { TenantCountryListQueryDto } from './dto/tenant-country-query.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

const EXAMPLE = {
  id: '019f357b-d398-73aa-9062-adc0f927a584',
  systemCode: 'CTR-MR8NZ6OO-0-C0CB',
  tenantBusinessId: '019f357b-c211-71a0-9062-adc0f927a584',
  countryName: 'India',
  countryNameTamil: 'இந்தியா',
  countryCode: 'IN',
  status: 'ACTIVE',
  createdAt: 1783308735,
  updatedAt: 1783308735,
  deletedAt: null,
};

@ApiTags('System / Tenant Countries')
@ApiBearerAuth()
@Controller('system/tenant-countries')
export class TenantCountriesController {
  constructor(private readonly service: TenantCountriesService) {}

  @Get()
  @RequirePermissions('tenant-countries:list')
  @ApiOperation({
    summary: 'List countries',
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
  findAll(@Query() query: TenantCountryListQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('tenant-countries:view')
  @ApiOperation({ summary: 'Get one country' })
  @ApiParam({ name: 'id', description: 'Country UUIDv7' })
  @ApiResponse({ status: 200, description: 'Detail.', schema: { example: EXAMPLE } })
  @ApiResponse({ status: 404, description: 'Country not found.' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions('tenant-countries:create')
  @ApiOperation({
    summary: 'Create a country',
    description: 'countryNameTamil is optional - may be recorded in English only.',
  })
  @ApiResponse({ status: 201, description: 'Created.', schema: { example: EXAMPLE } })
  @ApiResponse({ status: 400, description: 'Duplicate code for this business, or the tenant business does not exist.' })
  create(@Body() dto: CreateTenantCountryDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('tenant-countries:update')
  @ApiOperation({
    summary: 'Update a country',
    description: 'status cannot be set to DELETED here - use DELETE, which soft-deletes.',
  })
  @ApiParam({ name: 'id', description: 'Country UUIDv7' })
  @ApiResponse({ status: 200, description: 'Updated.', schema: { example: EXAMPLE } })
  @ApiResponse({ status: 404, description: 'Country not found.' })
  update(@Param('id') id: string, @Body() dto: UpdateTenantCountryDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('tenant-countries:delete')
  @ApiOperation({
    summary: 'Soft-delete a country',
    description:
      'Sets status=DELETED and stamps deletedAt. The row is never removed. ' +
      'Rejected while active states still reference it.',
  })
  @ApiParam({ name: 'id', description: 'Country UUIDv7' })
  @ApiResponse({ status: 200, description: 'Deleted.', schema: { example: { success: true } } })
  @ApiResponse({ status: 400, description: 'Country is still used by states.' })
  @ApiResponse({ status: 404, description: 'Country not found.' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Patch(':id/restore')
  @RequirePermissions('tenant-countries:restore')
  @ApiOperation({
    summary: 'Restore a soft-deleted country',
    description: 'System-admin only - the tenant surface has no restore route.',
  })
  @ApiParam({ name: 'id', description: 'Country UUIDv7' })
  @ApiResponse({ status: 200, description: 'Restored.', schema: { example: EXAMPLE } })
  @ApiResponse({ status: 404, description: 'Country not found or not deleted.' })
  restore(@Param('id') id: string) {
    return this.service.restore(id);
  }
}
