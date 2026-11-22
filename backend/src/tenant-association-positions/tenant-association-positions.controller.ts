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
import { TenantAssociationPositionsService } from './tenant-association-positions.service';
import {
  CreateTenantAssociationPositionDto,
  UpdateTenantAssociationPositionDto,
} from './dto/tenant-association-position.dto';
import { TenantAssociationPositionListQueryDto } from './dto/tenant-association-position-query.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

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

@ApiTags('System / Tenant Association Positions')
@ApiBearerAuth()
@Controller('system/tenant-association-positions')
export class TenantAssociationPositionsController {
  constructor(
    private readonly tenantAssociationPositionsService: TenantAssociationPositionsService,
  ) {}

  @Get()
  @RequirePermissions('tenant-association-positions:list')
  @ApiOperation({
    summary: 'List association positions',
    description:
      'Paginated, searchable, filterable, sortable list across every business. ' +
      'Search matches the English name, the Tamil name or the system code. ' +
      'Defaults to excluding deleted rows unless status=DELETED is explicitly requested.',
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
  findAll(@Query() query: TenantAssociationPositionListQueryDto) {
    return this.tenantAssociationPositionsService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('tenant-association-positions:view')
  @ApiOperation({ summary: 'Get one association position' })
  @ApiParam({ name: 'id', description: 'Association position UUIDv7' })
  @ApiResponse({
    status: 200,
    description: 'Association position detail.',
    schema: { example: ASSOCIATION_POSITION_EXAMPLE },
  })
  @ApiResponse({ status: 404, description: 'Association position not found.' })
  findOne(@Param('id') id: string) {
    return this.tenantAssociationPositionsService.findOne(id);
  }

  @Post()
  @RequirePermissions('tenant-association-positions:create')
  @ApiOperation({
    summary: 'Create an association position',
    description: 'positionNameTamil is optional - a position may be recorded in English only.',
  })
  @ApiResponse({
    status: 201,
    description: 'Association position created.',
    schema: { example: ASSOCIATION_POSITION_EXAMPLE },
  })
  @ApiResponse({ status: 400, description: 'Tenant business does not exist or is deleted.' })
  create(@Body() dto: CreateTenantAssociationPositionDto) {
    return this.tenantAssociationPositionsService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('tenant-association-positions:update')
  @ApiOperation({
    summary: 'Update an association position',
    description: 'status cannot be set to DELETED here - use DELETE, which soft-deletes.',
  })
  @ApiParam({ name: 'id', description: 'Association position UUIDv7' })
  @ApiResponse({
    status: 200,
    description: 'Association position updated.',
    schema: { example: ASSOCIATION_POSITION_EXAMPLE },
  })
  @ApiResponse({ status: 404, description: 'Association position not found.' })
  update(@Param('id') id: string, @Body() dto: UpdateTenantAssociationPositionDto) {
    return this.tenantAssociationPositionsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('tenant-association-positions:delete')
  @ApiOperation({
    summary: 'Soft-delete an association position',
    description: 'Sets status=DELETED and stamps deletedAt. The row is never removed.',
  })
  @ApiParam({ name: 'id', description: 'Association position UUIDv7' })
  @ApiResponse({
    status: 200,
    description: 'Association position deleted.',
    schema: { example: { success: true } },
  })
  @ApiResponse({ status: 404, description: 'Association position not found.' })
  remove(@Param('id') id: string) {
    return this.tenantAssociationPositionsService.remove(id);
  }

  @Patch(':id/restore')
  @RequirePermissions('tenant-association-positions:restore')
  @ApiOperation({
    summary: 'Restore a soft-deleted association position',
    description: 'System-admin only - the tenant surface has no restore route.',
  })
  @ApiParam({ name: 'id', description: 'Association position UUIDv7' })
  @ApiResponse({
    status: 200,
    description: 'Association position restored.',
    schema: { example: ASSOCIATION_POSITION_EXAMPLE },
  })
  @ApiResponse({ status: 404, description: 'Association position not found or not deleted.' })
  restore(@Param('id') id: string) {
    return this.tenantAssociationPositionsService.restore(id);
  }
}
