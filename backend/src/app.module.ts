import { Module } from '@nestjs/common';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ZodValidationPipe } from 'nestjs-zod';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { AuthModule } from './auth/auth.module';
import { TenantAuthModule } from './tenant-auth/tenant-auth.module';
import { PermissionsModule } from './permissions/permissions.module';
import { RolesModule } from './roles/roles.module';
import { SystemUsersModule } from './system-users/system-users.module';
import { TenantUsersModule } from './tenant-users/tenant-users.module';
import { TenantAccountModule } from './tenant-account/tenant-account.module';
import { TenantBusinessModule } from './tenant-business/tenant-business.module';
import { TenantMappedBusinessModule } from './tenant-mapped-business/tenant-mapped-business.module';
import { TenantMailConfigModule } from './tenant-mail-config/tenant-mail-config.module';
import { TenantPlacesModule } from './tenant-places/tenant-places.module';
import { TenantAssociationPositionsModule } from './tenant-association-positions/tenant-association-positions.module';
import { TenantStreetsModule } from './tenant-streets/tenant-streets.module';
import { AppSettingsModule } from './app-settings/app-settings.module';
import { SettingDefinitionsModule } from './setting-definitions/setting-definitions.module';
import { TenantBusinessSettingsModule } from './tenant-business-settings/tenant-business-settings.module';
import { SettingsSyncModule } from './settings-sync/settings-sync.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { HealthModule } from './health/health.module';
import { SetupModule } from './setup/setup.module';
import { SiteModule } from './site/site.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { ApiKeyScopeTemplatesModule } from './api-key-scope-templates/api-key-scope-templates.module';
import { TenantDashboardModule } from './tenant-dashboard/tenant-dashboard.module';
import { UploadsModule } from './uploads/uploads.module';
import { TenantUploadsModule } from './tenant-uploads/tenant-uploads.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { DeviceHeaderGuard } from './common/guards/device-header.guard';
import { DeviceAwareThrottlerGuard } from './common/guards/device-aware-throttler.guard';
import { ApiKeyGuard } from './api-keys/api-key.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: parseInt(config.get('THROTTLE_TTL_MS', '60000'), 10),
            limit: parseInt(config.get('THROTTLE_LIMIT', '100'), 10),
          },
        ],
      }),
    }),
    PrismaModule,
    StorageModule,
    AuthModule,
    TenantAuthModule,
    PermissionsModule,
    RolesModule,
    SystemUsersModule,
    TenantUsersModule,
    TenantAccountModule,
    TenantBusinessModule,
    TenantMappedBusinessModule,
    TenantMailConfigModule,
    TenantPlacesModule,
    TenantAssociationPositionsModule,
    TenantStreetsModule,
    AppSettingsModule,
    SettingDefinitionsModule,
    TenantBusinessSettingsModule,
    SettingsSyncModule,
    DashboardModule,
    HealthModule,
    SetupModule,
    SiteModule,
    ApiKeysModule,
    ApiKeyScopeTemplatesModule,
    TenantDashboardModule,
    UploadsModule,
    TenantUploadsModule,
  ],
  providers: [
    // Order matters: throttle -> device header -> API key -> JWT -> RBAC.
    // The throttler is device-aware (app device types get a larger budget,
    // because carrier NAT shares one IP between many users) and therefore
    // reads the x-device-type header itself - it runs before the guard that
    // validates it.
    { provide: APP_GUARD, useClass: DeviceAwareThrottlerGuard },
    { provide: APP_GUARD, useClass: DeviceHeaderGuard },
    // Before the session guards on purpose: an unknown client is rejected
    // without the cost of resolving a user and its role permissions. It fails
    // closed, so every route needs a key unless it carries @SkipApiKey().
    { provide: APP_GUARD, useClass: ApiKeyGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_PIPE, useClass: ZodValidationPipe },
  ],
})
export class AppModule {}
