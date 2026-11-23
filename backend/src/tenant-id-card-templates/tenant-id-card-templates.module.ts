import { Module } from '@nestjs/common';
import { IdCardTemplatesController } from './tenant-id-card-templates.controller';
import { TenantIdCardTemplatesSelfController } from './tenant-id-card-templates-self.controller';
import { TenantIdCardTemplatesService } from './tenant-id-card-templates.service';

@Module({
  controllers: [IdCardTemplatesController, TenantIdCardTemplatesSelfController],
  providers: [TenantIdCardTemplatesService],
  // TenantIdCardsModule reads the default template when generating a card.
  exports: [TenantIdCardTemplatesService],
})
export class TenantIdCardTemplatesModule {}
