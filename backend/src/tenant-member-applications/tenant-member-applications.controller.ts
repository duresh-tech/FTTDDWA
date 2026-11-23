import { Body, Controller, Delete, Get, Param, Patch, Query } from '@nestjs/common';
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
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

export const APPLICATION_EXAMPLE = {
  id: '019f357b-d398-73aa-9062-adc0f927a584',
  systemCode: 'APP-MR8NZ6OO-0-C0CB',
  tenantBusinessId: '019f357b-c211-71a0-9062-adc0f927a584',
  applicationNumber: '000001',
  memberName: 'Ramesh Kumar',
  memberNameTamil: 'ரமேஷ் குமார்',
  businessName: 'Kumar Tents & Decorators',
  // The number itself never leaves the server - only these four digits do,
  // and the password hash is never returned at all.
  aadhaarLast4: '9012',
  phoneNumber: '+91-9876543210',
  email: 'ramesh@example.com',
  status: 'PENDING',
  reviewedBy: null,
  reviewedAt: null,
  rejectionReason: null,
  convertedMemberId: null,
  createdAt: 1783308735,
  updatedAt: 1783308735,
};

@ApiTags('System / Member Applications')
@ApiBearerAuth()
@Controller('system/member-applications')
export class MemberApplicationsController {
  constructor(private readonly service: TenantMemberApplicationsService) {}

  @Get()
  @RequirePermissions('tenant-member-applications:list')
  @ApiOperation({
    summary: 'Cross-tenant view of membership applications',
    description:
      'Search matches both names in either script, the business name, phone, ' +
      'email, and the application and system codes - never the Aadhaar, which ' +
      'is encrypted.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated applications.',
    schema: { example: { items: [APPLICATION_EXAMPLE], meta: { total: 1, page: 1, limit: 20, totalPages: 1 } } },
  })
  findAll(@Query() query: MemberApplicationListQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('tenant-member-applications:view')
  @ApiOperation({ summary: 'Get one application' })
  @ApiParam({ name: 'id', description: 'Application UUIDv7' })
  @ApiResponse({ status: 200, description: 'Application detail.', schema: { example: APPLICATION_EXAMPLE } })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id/approve')
  @RequirePermissions('tenant-member-applications:approve')
  @ApiOperation({
    summary: 'Approve an application, creating the member',
    description:
      'One transaction: the member is created with a membership number from ' +
      "the RTO's sequence, the applicant's password hash is carried across so " +
      'they can sign in with what they chose, and the application records the ' +
      'member it became. The member is ACTIVE, not PENDING - this approval is ' +
      'the review PENDING exists for.',
  })
  @ApiParam({ name: 'id', description: 'Application UUIDv7' })
  @ApiResponse({ status: 200, description: 'The member that was created.' })
  @ApiResponse({ status: 400, description: 'Already approved, or previously rejected.' })
  approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.approve(id, user?.id);
  }

  @Patch(':id/reject')
  @RequirePermissions('tenant-member-applications:reject')
  @ApiOperation({
    summary: 'Reject an application',
    description:
      'The row stays, with its reason, so the Aadhaar blind index keeps ' +
      'catching a resubmission - reopening one is a staff decision, not ' +
      'something an applicant can force by filling the form again.',
  })
  @ApiParam({ name: 'id', description: 'Application UUIDv7' })
  @ApiResponse({ status: 200, description: 'Application rejected.', schema: { example: APPLICATION_EXAMPLE } })
  reject(
    @Param('id') id: string,
    @Body() dto: RejectMemberApplicationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.reject(id, dto, user?.id);
  }

  @Delete(':id')
  @RequirePermissions('tenant-member-applications:delete')
  @ApiOperation({ summary: 'Soft-delete an application' })
  @ApiParam({ name: 'id', description: 'Application UUIDv7' })
  @ApiResponse({ status: 200, description: 'Deleted.', schema: { example: { success: true } } })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
