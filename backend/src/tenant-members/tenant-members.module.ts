import { Module } from '@nestjs/common';
import { TenantMembersController } from './tenant-members.controller';
import { TenantMembersSelfController } from './tenant-members-self.controller';
import { TenantMembersService } from './tenant-members.service';
import { TenantBusinessSettingsModule } from '../tenant-business-settings/tenant-business-settings.module';

@Module({
  // For the memberRegister.enabled flag, which gates the tenant self-service
  // surface. No cycle: the settings module does not import this one.
  imports: [TenantBusinessSettingsModule],
  controllers: [TenantMembersController, TenantMembersSelfController],
  providers: [TenantMembersService],
  exports: [TenantMembersService],
})
export class TenantMembersModule {}
