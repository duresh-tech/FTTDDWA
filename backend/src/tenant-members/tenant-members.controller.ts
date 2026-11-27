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
import { TenantMembersService } from './tenant-members.service';
import {
  ChangeTenantMemberStatusDto,
  CreateTenantMemberDto,
  ResetTenantMemberPasswordDto,
  UpdateTenantMemberDto,
} from './dto/tenant-member.dto';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { TenantMemberListQueryDto } from './dto/tenant-member-query.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

const MEMBER_EXAMPLE = {
  id: '019f357b-d398-73aa-9062-adc0f927a584',
  systemCode: 'MEM-MR8NZ6OO-0-C0CB',
  tenantBusinessId: '019f357b-c211-71a0-9062-adc0f927a584',
  memberName: 'Ramesh Kumar',
  memberNameTamil: 'ரமேஷ் குமார்',
  businessName: 'Kumar Tents & Decorators',
  businessNameTamil: 'குமார் கூடாரம் & அலங்காரம்',
  associationPositionId: '019f357b-aa11-71a0-9062-adc0f927a584',
  industryId: '019f357b-bb22-71a0-9062-adc0f927a584',
  // The number itself never leaves the server - only these four digits do.
  aadhaarLast4: '9012',
  phoneNumber: '+91-9876543210',
  whatsappNumber: '+91-9876543210',
  email: 'ramesh@example.com',
  stateId: '019f357b-cc33-71a0-9062-adc0f927a584',
  districtId: '019f357b-dd44-71a0-9062-adc0f927a584',
  talukId: '019f357b-ee55-71a0-9062-adc0f927a584',
  addressLine1: '12 Bazaar Street',
  addressLine2: null,
  dateOfBirth: '1984-07-19',
  isMarried: true,
  weddingDate: '2010-02-14',
  passportPhotoPath: 'general/019f357c-d489-74a9-8490-1f82e745b199.jpg',
  remark: null,
  status: 'ACTIVE',
  createdAt: 1783308735,
  updatedAt: 1783308735,
  deletedAt: null,
};

@ApiTags('System / Tenant Members')
@ApiBearerAuth()
@Controller('system/tenant-members')
export class TenantMembersController {
  constructor(private readonly service: TenantMembersService) {}

  /**
   * True when the caller may override this business's fixed position.
   *
   * Read off the token's permissions, never taken from the request body,
   * and defaulted to false - an absent user or an absent array reads as
   * "may not", never as "may".
   */
  private mayMovePosition(user?: { permissions?: string[] }): boolean {
    return user?.permissions?.includes(TenantMembersService.POSITION_UPDATE_KEY) ?? false;
  }

  @Get()
  @RequirePermissions('tenant-members:list')
  @ApiOperation({
    summary: 'List members',
    description:
      'Paginated and filterable by status, position, industry and any level ' +
      'of the geography chain. Search matches both names in either script, ' +
      'the phone, the email or the system code - NOT the Aadhaar number, ' +
      'which is encrypted and can only be matched exactly.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated member list.',
    schema: { example: { items: [MEMBER_EXAMPLE], meta: { total: 1, page: 1, limit: 20, totalPages: 1 } } },
  })
  findAll(@Query() query: TenantMemberListQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('tenant-members:view')
  @ApiOperation({ summary: 'Get one member' })
  @ApiParam({ name: 'id', description: 'Member UUIDv7' })
  @ApiResponse({ status: 200, description: 'Member detail.', schema: { example: MEMBER_EXAMPLE } })
  @ApiResponse({ status: 404, description: 'Member not found.' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions('tenant-members:create')
  @ApiOperation({
    summary: 'Enrol a member',
    description:
      'The Aadhaar number is stored encrypted and never returned. Enrolling ' +
      'the same number twice for one business is refused. New members start ' +
      'PENDING; use the status endpoint to activate them.',
  })
  @ApiResponse({ status: 201, description: 'Member enrolled.', schema: { example: MEMBER_EXAMPLE } })
  @ApiResponse({
    status: 400,
    description:
      'Duplicate Aadhaar, a broken geography chain, an unknown position or ' +
      'industry, or a wedding date on an unmarried member.',
  })
  @ApiResponse({
    status: 403,
    description:
      'This business fixes the position members are filed under and you ' +
      'do not hold tenant-members:position_update.',
  })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTenantMemberDto) {
    return this.service.create(dto, this.mayMovePosition(user));
  }

  @Patch(':id')
  @RequirePermissions('tenant-members:update')
  @ApiOperation({
    summary: 'Update a member',
    description:
      'Leave aadhaarNumber blank or absent to keep the stored one - it reads ' +
      'back masked, so a blank submit means "unchanged", never "clear it". ' +
      'Clearing isMarried also clears weddingDate. Status is not settable ' +
      'here; use the status endpoint.',
  })
  @ApiParam({ name: 'id', description: 'Member UUIDv7' })
  @ApiResponse({ status: 200, description: 'Member updated.', schema: { example: MEMBER_EXAMPLE } })
  @ApiResponse({ status: 404, description: 'Member not found.' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateTenantMemberDto,
  ) {
    return this.service.update(id, dto, this.mayMovePosition(user));
  }

  @Patch(':id/password')
  @RequirePermissions('tenant-members:password_reset')
  @ApiOperation({
    summary: "Set a member's portal password",
    description:
      'Sets the password a member signs into the member portal with, ' +
      'without knowing the old one - which is why it carries its own ' +
      'permission rather than riding on update. It is equally how a ' +
      'member enrolled by staff gets portal access for the FIRST time: ' +
      'such a member has no password at all and cannot sign in until one ' +
      'is set here. Every refresh token the member holds is revoked, so ' +
      'open sessions end; an access token already issued survives until ' +
      'it expires and then cannot refresh. Nothing is emailed or texted ' +
      '- the password is handed over out of band.',
  })
  @ApiParam({ name: 'id', description: 'Member UUIDv7' })
  @ApiResponse({ status: 200, description: 'Password set.' })
  @ApiResponse({ status: 404, description: 'Member not found.' })
  resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetTenantMemberPasswordDto,
  ) {
    return this.service.resetPassword(id, dto);
  }

  @Patch(':id/status')
  @RequirePermissions('tenant-members:change_status')
  @ApiOperation({
    summary: 'Move a member through the membership lifecycle',
    description:
      'PENDING, ACTIVE, INACTIVE. Separate from update and separately ' +
      'permissioned, because ending someone’s membership is a different act ' +
      'from correcting their phone number. DELETED is not reachable here.',
  })
  @ApiParam({ name: 'id', description: 'Member UUIDv7' })
  @ApiResponse({ status: 200, description: 'Status changed.', schema: { example: MEMBER_EXAMPLE } })
  @ApiResponse({ status: 404, description: 'Member not found.' })
  changeStatus(@Param('id') id: string, @Body() dto: ChangeTenantMemberStatusDto) {
    return this.service.changeStatus(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('tenant-members:delete')
  @ApiOperation({
    summary: 'Soft-delete a member',
    description:
      'Sets status=DELETED and stamps deletedAt. The row stays, and so does ' +
      'its Aadhaar hash - so the same person cannot be re-enrolled as a ' +
      'second record while the first is recoverable.',
  })
  @ApiParam({ name: 'id', description: 'Member UUIDv7' })
  @ApiResponse({ status: 200, description: 'Member deleted.', schema: { example: { success: true } } })
  @ApiResponse({ status: 404, description: 'Member not found.' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Patch(':id/restore')
  @RequirePermissions('tenant-members:restore')
  @ApiOperation({
    summary: 'Restore a soft-deleted member',
    description:
      'Comes back as PENDING rather than ACTIVE: a membership that was ' +
      'deleted should be looked at again, not silently resumed. ' +
      'System-admin only.',
  })
  @ApiParam({ name: 'id', description: 'Member UUIDv7' })
  @ApiResponse({ status: 200, description: 'Member restored.', schema: { example: MEMBER_EXAMPLE } })
  @ApiResponse({ status: 404, description: 'Member not found or not deleted.' })
  restore(@Param('id') id: string) {
    return this.service.restore(id);
  }
}
