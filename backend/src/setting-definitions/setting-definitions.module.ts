import { Module } from '@nestjs/common';
import { SettingDefinitionsController } from './setting-definitions.controller';
import { SettingDefinitionsService } from './setting-definitions.service';
import { SettingsSyncModule } from '../settings-sync/settings-sync.module';

@Module({
  // Creating a definition, or turning its auto-sync on, backfills it to every
  // existing business through SettingsSyncService.
  imports: [SettingsSyncModule],
  controllers: [SettingDefinitionsController],
  providers: [SettingDefinitionsService],
  exports: [SettingDefinitionsService],
})
export class SettingDefinitionsModule {}
