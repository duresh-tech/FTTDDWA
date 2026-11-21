import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { TenantBusinessDomainsService } from './tenant-business-domains.service';
import { CreateDomainDto, DomainListQueryDto, UpdateDomainDto } from './dto/site.dto';

const DOMAIN_EXAMPLE = {
  id: '019f357b-e5b1-73aa-9062-adc0f927a584',
  tenantBusinessId: '019f357b-e5b1-73aa-9062-adc0f927a111',
  hostname: 'app.acme.com',
  enabled: true,
  createdBySystemUserId: '019f357b-e5b1-73aa-9062-adc0f927a222',
  createdAt: 1763500000,
  updatedAt: 1763500000,
  tenantBusiness: {
    id: '019f357b-e5b1-73aa-9062-adc0f927a111',
    name: 'Acme Ltd',
    systemCode: 'TBS-MBX2K1-4F7A',
  },
};

/**
 * The hostnames each business's portal is served on.
 *
 * System-admin only, with no tenant self-service twin - unlike every other
 * tenant-scoped resource here. Claiming a hostname is a trust boundary: a
 * tenant could otherwise assert ownership of a name they do not control and
 * have the edge request a certificate for it.
 *
 * See docs/guide/domains.
 */
@ApiTags('System / Tenant Business Domains')
@ApiBearerAuth()
@Controller('system/tenant-business-domains')
export class TenantBusinessDomainsController {
  constructor(private readonly domains: TenantBusinessDomainsService) {}

  @Get()
  @RequirePermissions('tenant-business-domains:list')
  @ApiOperation({ summary: 'List domains' })
  @ApiOkResponse({
    schema: {
      example: {
        items: [DOMAIN_EXAMPLE],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      },
    },
  })
  async findAll(@Query() query: DomainListQueryDto) {
    return this.domains.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('tenant-business-domains:view')
  @ApiOperation({ summary: 'View a domain' })
  @ApiParam({ name: 'id', description: 'Domain id (UUIDv7)' })
  @ApiOkResponse({ schema: { example: DOMAIN_EXAMPLE } })
  @ApiResponse({ status: 404, description: 'Domain not found.' })
  async findOne(@Param('id') id: string) {
    return this.domains.findOne(id);
  }

  @Post()
  @RequirePermissions('tenant-business-domains:create')
  @ApiOperation({
    summary: 'Add a domain',
    description:
      'The hostname is normalized to lowercase with any scheme, port or path ' +
      'stripped. A hostname reserved for the system console is refused, as is ' +
      'one already used by another business. Point DNS at this server before ' +
      'opening it, so the edge can complete the certificate challenge.',
  })
  @ApiResponse({ status: 201, description: 'Domain added.', schema: { example: DOMAIN_EXAMPLE } })
  @ApiResponse({ status: 400, description: 'Not a usable hostname, or reserved.' })
  @ApiResponse({ status: 409, description: 'This hostname is already used by a business.' })
  async create(@Body() dto: CreateDomainDto, @Req() req: Request) {
    const user = (req as Request & { user?: { id?: string } }).user;
    return this.domains.create(dto, user?.id);
  }

  @Patch(':id')
  @RequirePermissions('tenant-business-domains:update')
  @ApiOperation({
    summary: 'Enable or disable a domain',
    description:
      'The hostname itself is immutable - add a new domain and remove the old ' +
      'one, so the certificate for each follows its own hostname.',
  })
  @ApiParam({ name: 'id', description: 'Domain id (UUIDv7)' })
  @ApiOkResponse({ schema: { example: { ...DOMAIN_EXAMPLE, enabled: false } } })
  async update(@Param('id') id: string, @Body() dto: UpdateDomainDto) {
    return this.domains.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('tenant-business-domains:delete')
  @ApiOperation({
    summary: 'Remove a domain',
    description:
      'Removed outright rather than soft-deleted, so the hostname can be ' +
      'claimed again later. To keep the record, disable it instead.',
  })
  @ApiParam({ name: 'id', description: 'Domain id (UUIDv7)' })
  @ApiOkResponse({ schema: { example: { success: true } } })
  async remove(@Param('id') id: string) {
    return this.domains.remove(id);
  }
}
