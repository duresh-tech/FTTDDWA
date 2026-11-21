import { Module } from '@nestjs/common';
import { SiteController } from './site.controller';
import { SiteService } from './site.service';
import { TenantBusinessDomainsController } from './tenant-business-domains.controller';
import { TenantBusinessDomainsService } from './tenant-business-domains.service';

/**
 * Hostname resolution and the domains that drive it.
 *
 * SiteService is exported because the console's root page and the edge both
 * depend on it, and because a future per-host branding lookup will too.
 */
@Module({
  controllers: [SiteController, TenantBusinessDomainsController],
  providers: [SiteService, TenantBusinessDomainsService],
  exports: [SiteService],
})
export class SiteModule {}
