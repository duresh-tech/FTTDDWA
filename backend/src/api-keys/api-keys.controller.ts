import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { ApiKeysService } from './api-keys.service';
import {
  ApiKeyListQueryDto,
  CreateApiKeyDto,
  RevokeApiKeyDto,
  UpdateApiKeyDto,
} from './dto/api-key.dto';

/** The authenticated system user, with the permissions the guard resolved. */
function actor(req: Request): { id: string; permissions: string[] } {
  const user = (req as Request & { user?: { id?: string; permissions?: string[] } }).user;
  return { id: user?.id ?? '', permissions: user?.permissions ?? [] };
}

const SECRET_NOTE =
  'The secret is returned by this endpoint and nowhere else. Only a SHA-256 ' +
  'hash of it is stored, so it cannot be looked up later - a lost key is ' +
  'rotated, not recovered.';

const KEY_EXAMPLE = {
  id: '019f357b-e5b1-73aa-9062-adc0f927a584',
  systemCode: 'AKY-MBX2K1-4F7A',
  tenantBusinessId: null,
  title: 'Reporting client',
  keyType: 'TEST',
  keyPrefix: 'fttddwa_test_9f3a1c72',
  secretLast4: 'x7Qa',
  status: 'ACTIVE',
  expiresAt: null,
  isExpired: false,
  lastUsedAt: null,
  usageCount: 0,
  scopes: ['tenant-customers:view'],
};

/**
 * Machine credentials for external apps.
 *
 * A key authenticates the calling application; on these console routes the
 * signed-in user's RBAC is still what authorises the request.
 *
 * See docs/guide/api-keys.
 */
@ApiTags('System / API Keys')
@ApiBearerAuth()
@Controller('system/api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeys: ApiKeysService) {}

  @Get()
  @RequirePermissions('api-keys:list')
  @ApiOperation({ summary: 'List API keys', description: 'Never includes a secret.' })
  @ApiOkResponse({
    schema: {
      example: { items: [KEY_EXAMPLE], meta: { total: 1, page: 1, limit: 20, totalPages: 1 } },
    },
  })
  async findAll(@Query() query: ApiKeyListQueryDto) {
    // undefined = every business plus platform-level keys.
    return this.apiKeys.findAll(query, undefined);
  }

  @Get(':id')
  @RequirePermissions('api-keys:view')
  @ApiOperation({ summary: 'View an API key' })
  @ApiParam({ name: 'id', description: 'API key id (UUIDv7)' })
  @ApiOkResponse({ schema: { example: KEY_EXAMPLE } })
  async findOne(@Param('id') id: string) {
    return this.apiKeys.findOne(id);
  }

  @Post()
  @RequirePermissions('api-keys:create')
  @ApiOperation({
    summary: 'Issue an API key',
    description:
      'Returns the secret exactly once. ' +
      SECRET_NOTE +
      ' A key can only carry scopes the issuer holds themselves.',
  })
  @ApiCreatedResponse({
    schema: {
      example: { ...KEY_EXAMPLE, secret: '<43 characters>', token: 'fttddwa_test_9f3a1c72.<secret>' },
    },
  })
  @ApiResponse({ status: 403, description: 'A scope was requested that the issuer does not hold.' })
  async create(@Body() dto: CreateApiKeyDto, @Req() req: Request) {
    const me = actor(req);
    return this.apiKeys.create(dto, { permissions: me.permissions, systemUserId: me.id });
  }

  @Patch(':id')
  @RequirePermissions('api-keys:update')
  @ApiOperation({
    summary: 'Update an API key',
    description:
      'Title, description, status, scopes and expiry. The key type and owning ' +
      'business are immutable - issue a new key instead.',
  })
  @ApiParam({ name: 'id', description: 'API key id (UUIDv7)' })
  @ApiOkResponse({ schema: { example: KEY_EXAMPLE } })
  @ApiResponse({ status: 409, description: 'A revoked key cannot be changed.' })
  async update(@Param('id') id: string, @Body() dto: UpdateApiKeyDto, @Req() req: Request) {
    return this.apiKeys.update(id, dto, { permissions: actor(req).permissions });
  }

  @Patch(':id/rotate')
  @RequirePermissions('api-keys:rotate')
  @ApiOperation({
    summary: 'Rotate the secret',
    description:
      'Issues a new secret and prefix; the previous pair stops working at once. ' +
      SECRET_NOTE,
  })
  @ApiParam({ name: 'id', description: 'API key id (UUIDv7)' })
  @ApiOkResponse({
    schema: {
      example: { ...KEY_EXAMPLE, secret: '<43 characters>', token: 'fttddwa_test_1a2b3c4d.<secret>' },
    },
  })
  async rotate(@Param('id') id: string) {
    return this.apiKeys.rotate(id);
  }

  @Patch(':id/revoke')
  @RequirePermissions('api-keys:revoke')
  @ApiOperation({
    summary: 'Revoke an API key',
    description:
      'Terminal and irreversible: the stored hash is scrubbed, so the key cannot ' +
      'authenticate again even if a later query forgets the status check.',
  })
  @ApiParam({ name: 'id', description: 'API key id (UUIDv7)' })
  @ApiOkResponse({ schema: { example: { ...KEY_EXAMPLE, status: 'REVOKED' } } })
  async revoke(@Param('id') id: string, @Body() dto: RevokeApiKeyDto) {
    return this.apiKeys.revoke(id, dto);
  }
}
