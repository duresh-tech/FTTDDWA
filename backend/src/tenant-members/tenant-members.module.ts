import { Module } from '@nestjs/common';
import { TenantMembersController } from './tenant-members.controller';
import { TenantMembersSelfController } from './tenant-members-self.controller';
import { TenantMembersService } from './tenant-members.service';

@Module({
  controllers: [TenantMembersController, TenantMembersSelfController],
  providers: [TenantMembersService],
  exports: [TenantMembersService],
})
export class TenantMembersModule {}
