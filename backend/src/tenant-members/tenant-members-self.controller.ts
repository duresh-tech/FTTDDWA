import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
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
import { TenantMembersService } from './tenant-members.service';
import {
  ChangeTenantMemberStatusDto,
  CreateTenantMemberDto,
  UpdateTenantMemberDto,
} from './dto/tenant-member.dto';
import { TenantMemberListQueryDto } from './dto/tenant-member-query.dto';
import { Public } from '../common/decorators/public.decorator';
import { RequireTenantPermissions } from '../common/decorators/require-tenant-permissions.decorator';
import {
  CurrentTenantUser,
  TenantAuthUser,
} from '../common/decorators/current-tenant-user.decorator';
import { TenantJwtAuthGuard } from '../common/guards/tenant-jwt-auth.guard';
import { TenantPermissionsGuard } from '../common/guards/tenant-permissions.guard';

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


// @Public() escapes the SYSTEM JWT guard so the tenant guard pair below can
// take over. It does NOT make the route public: an API key is still required,
// and TenantJwtAuthGuard still demands a tenant session.
@ApiTags('Tenant / Members')
@ApiBearerAuth()
@Public()
@UseGuards(TenantJwtAuthGuard, TenantPermissionsGuard)
@Controller('tenant/members')
export class TenantMembersSelfController {
  constructor(private readonly service: TenantMembersService) {}

  // Declared BEFORE @Get(':id'), or the param route matches "businesses".
  @Get('businesses')
  @RequireTenantPermissions('tenant-members:list')
  @ApiOperation({
    summary: 'The businesses the caller may enrol members under',
    description:
      'Powers the business picker. A caller mapped to a single business gets ' +
      'one row, and the screen selects it automatically.',
  })
  @ApiResponse({ status: 200, description: 'Mapped businesses.' })
  listBusinesses(@CurrentTenantUser() user: TenantAuthUser) {
    return this.service.listMappedBusinesses(user.id);
  }

  @Get()
  @RequireTenantPermissions('tenant-members:list')
  @ApiOperation({
    summary: "List the caller's own members",
    description:
      'Scoped to the businesses mapped to the caller. A tenantBusinessId in ' +
      'the query is intersected with that set, never trusted.',
  })
  @ApiResponse({ status: 200, description: 'Paginated member list.' })
  findAll(
    @CurrentTenantUser() user: TenantAuthUser,
    @Query() query: TenantMemberListQueryDto,
  ) {
    return this.service.findAllForTenantUser(user.id, query);
  }

  @Get(':id')
  @RequireTenantPermissions('tenant-members:view')
  @ApiOperation({ summary: "Get one of the caller's own members" })
  @ApiParam({ name: 'id', description: 'Member UUIDv7' })
  @ApiResponse({ status: 200, description: 'Member detail.', schema: { example: MEMBER_EXAMPLE } })
  @ApiResponse({ status: 404, description: 'Member not found.' })
  findOne(@CurrentTenantUser() user: TenantAuthUser, @Param('id') id: string) {
    return this.service.findOneForTenantUser(user.id, id);
  }

  @Post()
  @RequireTenantPermissions('tenant-members:create')
  @ApiOperation({
    summary: "Enrol a member for one of the caller's businesses",
    description:
      'The Aadhaar number is stored encrypted and never returned. Enrolling ' +
      'the same number twice for one business is refused.',
  })
  @ApiResponse({ status: 201, description: 'Member enrolled.', schema: { example: MEMBER_EXAMPLE } })
  @ApiResponse({ status: 403, description: 'You are not mapped to this business.' })
  create(
    @CurrentTenantUser() user: TenantAuthUser,
    @Body() dto: CreateTenantMemberDto,
  ) {
    return this.service.createForTenantUser(user.id, dto);
  }

  @Patch(':id')
  @RequireTenantPermissions('tenant-members:update')
  @ApiOperation({
    summary: "Update one of the caller's own members",
    description:
      'Leave aadhaarNumber blank to keep the stored one. Clearing isMarried ' +
      'also clears weddingDate.',
  })
  @ApiParam({ name: 'id', description: 'Member UUIDv7' })
  @ApiResponse({ status: 200, description: 'Member updated.', schema: { example: MEMBER_EXAMPLE } })
  @ApiResponse({ status: 404, description: 'Member not found.' })
  update(
    @CurrentTenantUser() user: TenantAuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateTenantMemberDto,
  ) {
    return this.service.updateForTenantUser(user.id, id, dto);
  }

  @Patch(':id/status')
  @RequireTenantPermissions('tenant-members:change_status')
  @ApiOperation({
    summary: "Move one of the caller's own members through the lifecycle",
    description: 'Separately permissioned from update. DELETED is not reachable here.',
  })
  @ApiParam({ name: 'id', description: 'Member UUIDv7' })
  @ApiResponse({ status: 200, description: 'Status changed.', schema: { example: MEMBER_EXAMPLE } })
  @ApiResponse({ status: 404, description: 'Member not found.' })
  changeStatus(
    @CurrentTenantUser() user: TenantAuthUser,
    @Param('id') id: string,
    @Body() dto: ChangeTenantMemberStatusDto,
  ) {
    return this.service.changeStatusForTenantUser(user.id, id, dto);
  }

  // No restore route: restoring is a system-admin act, and the tenant
  // permission set deliberately omits the :restore key.
  @Delete(':id')
  @RequireTenantPermissions('tenant-members:delete')
  @ApiOperation({ summary: "Soft-delete one of the caller's own members" })
  @ApiParam({ name: 'id', description: 'Member UUIDv7' })
  @ApiResponse({ status: 200, description: 'Member deleted.', schema: { example: { success: true } } })
  @ApiResponse({ status: 404, description: 'Member not found.' })
  remove(@CurrentTenantUser() user: TenantAuthUser, @Param('id') id: string) {
    return this.service.removeForTenantUser(user.id, id);
  }
}
