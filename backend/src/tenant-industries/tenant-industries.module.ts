import { Module } from '@nestjs/common';
import { TenantIndustriesController } from './tenant-industries.controller';
import { TenantIndustriesSelfController } from './tenant-industries-self.controller';
import { TenantIndustriesService } from './tenant-industries.service';

@Module({
  controllers: [TenantIndustriesController, TenantIndustriesSelfController],
  providers: [TenantIndustriesService],
  exports: [TenantIndustriesService],
})
export class TenantIndustriesModule {}
