import { Module } from '@nestjs/common';
import { MemberApplicationsController } from './tenant-member-applications.controller';
import { TenantMemberApplicationsSelfController } from './tenant-member-applications-self.controller';
import { TenantMemberApplicationsService } from './tenant-member-applications.service';
import { TenantBusinessSettingsModule } from '../tenant-business-settings/tenant-business-settings.module';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';

@Module({
  // Settings for the memberRegister.enabled gate; Members for the conversion,
  // which reuses that module's membership-number allocator. No cycle: neither
  // imports this one.
  imports: [TenantBusinessSettingsModule, TenantMembersModule],
  controllers: [MemberApplicationsController, TenantMemberApplicationsSelfController],
  providers: [TenantMemberApplicationsService],
  // SiteModule serves the public submission endpoint through this service.
  exports: [TenantMemberApplicationsService],
})
export class TenantMemberApplicationsModule {}
