import { Module } from '@nestjs/common';
import { TenantTaluksController } from './tenant-taluks.controller';
import { TenantTaluksSelfController } from './tenant-taluks-self.controller';
import { TenantTaluksService } from './tenant-taluks.service';

@Module({
  controllers: [TenantTaluksController, TenantTaluksSelfController],
  providers: [TenantTaluksService],
  exports: [TenantTaluksService],
})
export class TenantTaluksModule {}
