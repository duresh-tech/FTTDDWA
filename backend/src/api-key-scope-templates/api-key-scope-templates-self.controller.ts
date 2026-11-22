import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { RequireTenantPermissions } from '../common/decorators/require-tenant-permissions.decorator';
import {
  CurrentTenantUser,
  type TenantAuthUser,
} from '../common/decorators/current-tenant-user.decorator';
import { TenantJwtAuthGuard } from '../common/guards/tenant-jwt-auth.guard';
import { TenantPermissionsGuard } from '../common/guards/tenant-permissions.guard';
import { ApiKeyScopeTemplatesService } from './api-key-scope-templates.service';

/**
 * The scope templates a tenant may choose when issuing a key.
 *
 * Gated on `api-keys:create` rather than a template permission: this list
 * exists only to fill that form.
 */
@ApiTags('Tenant / API Key Scope Templates')
@ApiBearerAuth()
@Public()
@UseGuards(TenantJwtAuthGuard, TenantPermissionsGuard)
@Controller('tenant/api-key-scope-templates')
export class ApiKeyScopeTemplatesSelfController {
  constructor(private readonly templates: ApiKeyScopeTemplatesService) {}

  @Get()
  @RequireTenantPermissions('api-keys:create')
  @ApiOperation({
    summary: 'Scope templates offered to tenants',
    description:
      'Each is marked grantable or not against the permissions you hold. A ' +
      'non-grantable template is listed with what it is missing rather than ' +
      'hidden, so it is clear why it cannot be chosen.',
  })
  @ApiOkResponse({
    schema: {
      example: [
        {
          id: '019f357b-e5b1-73aa-9062-adc0f927a584',
          name: 'Reporting client',
          description: 'Read-only access',
          scopes: ['tenant-places:list'],
          grantable: true,
          missingScopes: [],
        },
      ],
    },
  })
  async findAll(@CurrentTenantUser() user: TenantAuthUser) {
    return this.templates.findForTenant(user.permissions ?? []);
  }
}
