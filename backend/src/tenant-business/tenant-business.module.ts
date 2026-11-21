import { Module } from '@nestjs/common';
import { TenantBusinessController } from './tenant-business.controller';
import { TenantBusinessSelfController } from './tenant-business-self.controller';
import { TenantBusinessService } from './tenant-business.service';
import { TenantBusinessSettingsModule } from '../tenant-business-settings/tenant-business-settings.module';

@Module({
  // create() seeds the new business's settings inside its own transaction.
  imports: [TenantBusinessSettingsModule],
  controllers: [TenantBusinessController, TenantBusinessSelfController],
  providers: [TenantBusinessService],
  exports: [TenantBusinessService],
})
export class TenantBusinessModule {}
