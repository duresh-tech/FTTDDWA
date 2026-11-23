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
import { TenantRtosService } from './tenant-rtos.service';
import { CreateTenantRtoDto, UpdateTenantRtoDto } from './dto/tenant-rto.dto';
import { TenantRtoListQueryDto } from './dto/tenant-rto-query.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

export const RTO_EXAMPLE = {
  id: '019f357b-d398-73aa-9062-adc0f927a584',
  systemCode: 'RTO-MR8NZ6OO-0-C0CB',
  tenantBusinessId: '019f357b-c211-71a0-9062-adc0f927a584',
  tenantDistrictId: '019f357b-dd44-71a0-9062-adc0f927a584',
  rtoName: 'Coimbatore South',
  rtoNameTamil: 'கோயம்புத்தூர் தெற்கு',
  rtoCode: 'TN38',
  status: 'ACTIVE',
  createdAt: 1783308735,
  updatedAt: 1783308735,
  deletedAt: null,
};

@ApiTags('System / Tenant RTOs')
@ApiBearerAuth()
@Controller('system/tenant-rtos')
export class TenantRtosController {
  constructor(private readonly service: TenantRtosService) {}

  // Declared BEFORE @Get(':id'), or the param route swallows it and ":id"
  // arrives as the literal string "districts".
  @Get('districts')
  @RequirePermissions('tenant-rtos:list')
  @ApiOperation({
    summary: 'Options for the district picker',
    description: 'A bare array, not a paginated envelope - it fills a dropdown.',
  })
  @ApiQuery({ name: 'tenantBusinessId', required: true })
  @ApiResponse({ status: 200, description: 'District options.' })
  listDistricts(@Query('tenantBusinessId') tenantBusinessId: string) {
    return this.service.listDistricts(tenantBusinessId);
  }

  @Get()
  @RequirePermissions('tenant-rtos:list')
  @ApiOperation({
    summary: 'List RTOs',
    description:
      'Paginated and filterable by status, business and district. Search ' +
      'matches the name in either script, the RTO code or the system code.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated RTO list.',
    schema: { example: { items: [RTO_EXAMPLE], meta: { total: 1, page: 1, limit: 20, totalPages: 1 } } },
  })
  findAll(@Query() query: TenantRtoListQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('tenant-rtos:view')
  @ApiOperation({ summary: 'Get one RTO' })
  @ApiParam({ name: 'id', description: 'RTO UUIDv7' })
  @ApiResponse({ status: 200, description: 'RTO detail.', schema: { example: RTO_EXAMPLE } })
  @ApiResponse({ status: 404, description: 'RTO not found.' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions('tenant-rtos:create')
  @ApiOperation({
    summary: 'Create an RTO',
    description:
      'The district must belong to the same business, and the RTO code must ' +
      'be unused by it - including by a soft-deleted RTO, so restoring one ' +
      'cannot collide.',
  })
  @ApiResponse({ status: 201, description: 'RTO created.', schema: { example: RTO_EXAMPLE } })
  @ApiResponse({ status: 400, description: 'Duplicate code, or a district from another business.' })
  create(@Body() dto: CreateTenantRtoDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('tenant-rtos:update')
  @ApiOperation({ summary: 'Update an RTO' })
  @ApiParam({ name: 'id', description: 'RTO UUIDv7' })
  @ApiResponse({ status: 200, description: 'RTO updated.', schema: { example: RTO_EXAMPLE } })
  @ApiResponse({ status: 404, description: 'RTO not found.' })
  update(@Param('id') id: string, @Body() dto: UpdateTenantRtoDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('tenant-rtos:delete')
  @ApiOperation({
    summary: 'Soft-delete an RTO',
    description:
      'Sets status=DELETED and stamps deletedAt. Members still reference it, ' +
      'and the FK is RESTRICT, so the row stays.',
  })
  @ApiParam({ name: 'id', description: 'RTO UUIDv7' })
  @ApiResponse({ status: 200, description: 'RTO deleted.', schema: { example: { success: true } } })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Patch(':id/restore')
  @RequirePermissions('tenant-rtos:restore')
  @ApiOperation({ summary: 'Restore a soft-deleted RTO. System-admin only.' })
  @ApiParam({ name: 'id', description: 'RTO UUIDv7' })
  @ApiResponse({ status: 200, description: 'RTO restored.', schema: { example: RTO_EXAMPLE } })
  restore(@Param('id') id: string) {
    return this.service.restore(id);
  }
}
