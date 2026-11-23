import { Module } from '@nestjs/common';
import { MemberIdCardsController } from './tenant-id-cards.controller';
import { TenantIdCardsSelfController } from './tenant-id-cards-self.controller';
import { TenantIdCardsService } from './tenant-id-cards.service';
import { IdCardRendererService } from './id-card-renderer.service';
import { MemberIdCardController } from './member-id-card.controller';
import { TenantBusinessSettingsModule } from '../tenant-business-settings/tenant-business-settings.module';

@Module({
  // For the association branding a card prints, and for the
  // memberRegister.enabled flag. StorageModule is @Global(), so the private
  // PDF area and the image reads need no import here.
  imports: [TenantBusinessSettingsModule],
  controllers: [
    MemberIdCardsController,
    TenantIdCardsSelfController,
    // The member's own card, guarded by the member JWT rather than a
    // permission - a member holds no RBAC role.
    MemberIdCardController,
  ],
  providers: [TenantIdCardsService, IdCardRendererService],
  exports: [TenantIdCardsService],
})
export class TenantIdCardsModule {}
