import { Module } from '@nestjs/common';
import { TenantBusinessSettingsController } from './tenant-business-settings.controller';
import { TenantBusinessSettingsSelfController } from './tenant-business-settings-self.controller';
import { TenantBusinessSettingsService } from './tenant-business-settings.service';

@Module({
  controllers: [TenantBusinessSettingsController, TenantBusinessSettingsSelfController],
  providers: [TenantBusinessSettingsService],
  // TenantBusinessModule calls copyDefaultsForBusiness() inside its create
  // transaction; application code reads values via getSettingsMapForBusiness().
  exports: [TenantBusinessSettingsService],
})
export class TenantBusinessSettingsModule {}
