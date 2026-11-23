import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TenantMemberApplicationsService } from './tenant-member-applications.service';
import { RejectMemberApplicationDto } from './dto/member-application.dto';
import { MemberApplicationListQueryDto } from './dto/member-application-query.dto';
import { APPLICATION_EXAMPLE } from './tenant-member-applications.controller';
import { Public } from '../common/decorators/public.decorator';
import { RequireTenantPermissions } from '../common/decorators/require-tenant-permissions.decorator';
import {
  CurrentTenantUser,
  TenantAuthUser,
} from '../common/decorators/current-tenant-user.decorator';
import { TenantJwtAuthGuard } from '../common/guards/tenant-jwt-auth.guard';
import { TenantPermissionsGuard } from '../common/guards/tenant-permissions.guard';

// @Public() escapes the SYSTEM JWT guard so the tenant guard pair below can
// take over. It does NOT make the route public: an API key is still required,
// and TenantJwtAuthGuard still demands a tenant session.
@ApiTags('Tenant / Member Applications')
@ApiBearerAuth()
@Public()
@UseGuards(TenantJwtAuthGuard, TenantPermissionsGuard)
@Controller('tenant/member-applications')
export class TenantMemberApplicationsSelfController {
  constructor(private readonly service: TenantMemberApplicationsService) {}

  @Get()
  @RequireTenantPermissions('tenant-member-applications:list')
  @ApiOperation({ summary: "List the caller's own businesses' applications" })
  @ApiResponse({ status: 200, description: 'Paginated applications.' })
  findAll(
    @CurrentTenantUser() user: TenantAuthUser,
    @Query() query: MemberApplicationListQueryDto,
  ) {
    return this.service.findAllForTenantUser(user.id, query);
  }

  @Get(':id')
  @RequireTenantPermissions('tenant-member-applications:view')
  @ApiOperation({ summary: 'Get one application' })
  @ApiParam({ name: 'id', description: 'Application UUIDv7' })
  @ApiResponse({ status: 200, description: 'Application detail.', schema: { example: APPLICATION_EXAMPLE } })
  async findOne(@CurrentTenantUser() user: TenantAuthUser, @Param('id') id: string) {
    await this.service.assertOwned(user.id, id);
    return this.service.findOne(id);
  }

  @Patch(':id/approve')
  @RequireTenantPermissions('tenant-member-applications:approve')
  @ApiOperation({
    summary: 'Approve an application, creating the member',
    description:
      'One transaction. The member is created ACTIVE with a membership number ' +
      "from the RTO's sequence, keeping the password the applicant chose.",
  })
  @ApiParam({ name: 'id', description: 'Application UUIDv7' })
  @ApiResponse({ status: 200, description: 'The member that was created.' })
  async approve(@CurrentTenantUser() user: TenantAuthUser, @Param('id') id: string) {
    await this.service.assertOwned(user.id, id);
    return this.service.approve(id, user.id);
  }

  @Patch(':id/reject')
  @RequireTenantPermissions('tenant-member-applications:reject')
  @ApiOperation({ summary: 'Reject an application' })
  @ApiParam({ name: 'id', description: 'Application UUIDv7' })
  @ApiResponse({ status: 200, description: 'Application rejected.', schema: { example: APPLICATION_EXAMPLE } })
  async reject(
    @CurrentTenantUser() user: TenantAuthUser,
    @Param('id') id: string,
    @Body() dto: RejectMemberApplicationDto,
  ) {
    await this.service.assertOwned(user.id, id);
    return this.service.reject(id, dto, user.id);
  }

  @Delete(':id')
  @RequireTenantPermissions('tenant-member-applications:delete')
  @ApiOperation({ summary: 'Soft-delete an application' })
  @ApiParam({ name: 'id', description: 'Application UUIDv7' })
  @ApiResponse({ status: 200, description: 'Deleted.', schema: { example: { success: true } } })
  async remove(@CurrentTenantUser() user: TenantAuthUser, @Param('id') id: string) {
    await this.service.assertOwned(user.id, id);
    return this.service.remove(id);
  }
}
