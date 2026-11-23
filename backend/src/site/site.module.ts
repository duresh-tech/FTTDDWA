import { Module } from '@nestjs/common';
import { SiteController } from './site.controller';
import { SiteService } from './site.service';
import { MemberSiteController } from './member-site.controller';
import { MemberSiteService } from './member-site.service';
import { TenantBusinessDomainsController } from './tenant-business-domains.controller';
import { TenantBusinessDomainsService } from './tenant-business-domains.service';
import { TenantBusinessSettingsModule } from '../tenant-business-settings/tenant-business-settings.module';
import { TenantMemberApplicationsModule } from '../tenant-member-applications/tenant-member-applications.module';

/**
 * Hostname resolution and the domains that drive it, plus everything an
 * association's own domain serves to a visitor who has not signed in.
 *
 * SiteService is exported because the console's root page and the edge both
 * depend on it, and because a future per-host branding lookup will too.
 */
@Module({
  // Settings for the association's public details and the registration gate;
  // Applications for the submission itself. Neither imports this module back.
  imports: [TenantBusinessSettingsModule, TenantMemberApplicationsModule],
  controllers: [SiteController, MemberSiteController, TenantBusinessDomainsController],
  providers: [SiteService, MemberSiteService, TenantBusinessDomainsService],
  // MemberSiteService is exported for MemberAuthModule, which needs the
  // same hostname-to-business resolution at login.
  exports: [SiteService, MemberSiteService],
})
export class SiteModule {}
