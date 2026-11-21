import { Module } from '@nestjs/common';
import { SettingsSyncController } from './settings-sync.controller';
import { SettingsSyncService } from './settings-sync.service';

@Module({
  controllers: [SettingsSyncController],
  providers: [SettingsSyncService],
  // SettingDefinitionsService runs a sync when a definition is created or
  // flipped to autoSyncToExistingTenants.
  exports: [SettingsSyncService],
})
export class SettingsSyncModule {}
