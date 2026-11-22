import { Module } from '@nestjs/common';
import { TenantDistrictsController } from './tenant-districts.controller';
import { TenantDistrictsSelfController } from './tenant-districts-self.controller';
import { TenantDistrictsService } from './tenant-districts.service';

@Module({
  controllers: [TenantDistrictsController, TenantDistrictsSelfController],
  providers: [TenantDistrictsService],
  exports: [TenantDistrictsService],
})
export class TenantDistrictsModule {}
