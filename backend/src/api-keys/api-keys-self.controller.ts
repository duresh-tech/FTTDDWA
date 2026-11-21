import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { RequireTenantPermissions } from '../common/decorators/require-tenant-permissions.decorator';
import {
  CurrentTenantUser,
  type TenantAuthUser,
} from '../common/decorators/current-tenant-user.decorator';
import { TenantJwtAuthGuard } from '../common/guards/tenant-jwt-auth.guard';
import { TenantPermissionsGuard } from '../common/guards/tenant-permissions.guard';
import { PrismaService } from '../prisma/prisma.service';
import { ApiKeysService } from './api-keys.service';
import {
  ApiKeyListQueryDto,
  CreateApiKeyDto,
  RevokeApiKeyDto,
  UpdateApiKeyDto,
} from './dto/api-key.dto';

/**
 * A business's own API keys.
 *
 * `@Public()` turns off the SYSTEM JWT guard so the tenant guard pair below
 * can take over - it does not make these routes unauthenticated, and it has
 * no effect on the API key requirement, which is a separate axis.
 *
 * Every call is confined to a business the caller is actually mapped to, and
 * `tenantBusinessId` in a create body is ignored in favour of that.
 */
@ApiTags('Tenant / API Keys')
@ApiBearerAuth()
@Public()
@UseGuards(TenantJwtAuthGuard, TenantPermissionsGuard)
@Controller('tenant/api-keys')
export class ApiKeysSelfController {
  constructor(
    private readonly apiKeys: ApiKeysService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * The business this call acts for.
   *
   * Explicit rather than "whichever mapping comes back first": a user mapped
   * to several businesses would otherwise silently read and write one of them
   * at random. Mapped to exactly one, it is implied; mapped to several, the
   * caller must say which.
   */
  private async resolveBusiness(tenantUserId: string, requested?: string): Promise<string> {
    const mappings = await this.prisma.tenantMappedBusiness.findMany({
      where: { tenantUserId, status: 'ACTIVE' },
      select: { tenantBusinessId: true },
    });
    const ids = mappings.map((m) => m.tenantBusinessId);

    if (ids.length === 0) throw new ForbiddenException('No business mapped to this account');
    if (requested) {
      if (!ids.includes(requested)) {
        throw new ForbiddenException('That business is not mapped to this account');
      }
      return requested;
    }
    if (ids.length > 1) {
      throw new ForbiddenException(
        'This account is mapped to several businesses - name one with tenantBusinessId',
      );
    }
    return ids[0];
  }

  @Get()
  @RequireTenantPermissions('api-keys:list')
  @ApiOperation({ summary: "List this business's API keys" })
  async findAll(
    @CurrentTenantUser() user: TenantAuthUser,
    @Query() query: ApiKeyListQueryDto,
    @Query('tenantBusinessId') requested?: string,
  ) {
    const businessId = await this.resolveBusiness(user.id, requested);
    return this.apiKeys.findAll(query, businessId);
  }

  @Get(':id')
  @RequireTenantPermissions('api-keys:view')
  @ApiOperation({ summary: 'View an API key' })
  @ApiParam({ name: 'id', description: 'API key id (UUIDv7)' })
  async findOne(
    @CurrentTenantUser() user: TenantAuthUser,
    @Param('id') id: string,
    @Query('tenantBusinessId') requested?: string,
  ) {
    const businessId = await this.resolveBusiness(user.id, requested);
    return this.apiKeys.findOne(id, businessId);
  }

  @Post()
  @RequireTenantPermissions('api-keys:create')
  @ApiOperation({
    summary: 'Issue an API key for this business',
    description:
      'Returns the secret exactly once - it is hashed before storage and cannot ' +
      'be shown again. A key can only carry scopes the issuer holds themselves.',
  })
  async create(@CurrentTenantUser() user: TenantAuthUser, @Body() dto: CreateApiKeyDto) {
    const businessId = await this.resolveBusiness(user.id, dto.tenantBusinessId);
    return this.apiKeys.create(
      dto,
      { permissions: user.permissions ?? [], tenantUserId: user.id },
      businessId,
    );
  }

  @Patch(':id')
  @RequireTenantPermissions('api-keys:update')
  @ApiOperation({ summary: 'Update an API key' })
  @ApiParam({ name: 'id', description: 'API key id (UUIDv7)' })
  async update(
    @CurrentTenantUser() user: TenantAuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateApiKeyDto,
    @Query('tenantBusinessId') requested?: string,
  ) {
    const businessId = await this.resolveBusiness(user.id, requested);
    return this.apiKeys.update(id, dto, { permissions: user.permissions ?? [] }, businessId);
  }

  @Patch(':id/rotate')
  @RequireTenantPermissions('api-keys:rotate')
  @ApiOperation({ summary: 'Rotate the secret' })
  @ApiParam({ name: 'id', description: 'API key id (UUIDv7)' })
  @ApiOkResponse({ description: 'The previous secret stops working immediately.' })
  async rotate(
    @CurrentTenantUser() user: TenantAuthUser,
    @Param('id') id: string,
    @Query('tenantBusinessId') requested?: string,
  ) {
    const businessId = await this.resolveBusiness(user.id, requested);
    return this.apiKeys.rotate(id, businessId);
  }

  @Patch(':id/revoke')
  @RequireTenantPermissions('api-keys:revoke')
  @ApiOperation({ summary: 'Revoke an API key', description: 'Terminal and irreversible.' })
  @ApiParam({ name: 'id', description: 'API key id (UUIDv7)' })
  async revoke(
    @CurrentTenantUser() user: TenantAuthUser,
    @Param('id') id: string,
    @Body() dto: RevokeApiKeyDto,
    @Query('tenantBusinessId') requested?: string,
  ) {
    const businessId = await this.resolveBusiness(user.id, requested);
    return this.apiKeys.revoke(id, dto, businessId);
  }
}
