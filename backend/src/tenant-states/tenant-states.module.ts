import { Module } from '@nestjs/common';
import { TenantStatesController } from './tenant-states.controller';
import { TenantStatesSelfController } from './tenant-states-self.controller';
import { TenantStatesService } from './tenant-states.service';

@Module({
  controllers: [TenantStatesController, TenantStatesSelfController],
  providers: [TenantStatesService],
  exports: [TenantStatesService],
})
export class TenantStatesModule {}
