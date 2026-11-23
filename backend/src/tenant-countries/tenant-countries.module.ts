import { Module } from '@nestjs/common';
import { TenantCountriesController } from './tenant-countries.controller';
import { TenantCountriesSelfController } from './tenant-countries-self.controller';
import { TenantCountriesService } from './tenant-countries.service';

@Module({
  controllers: [TenantCountriesController, TenantCountriesSelfController],
  providers: [TenantCountriesService],
  exports: [TenantCountriesService],
})
export class TenantCountriesModule {}
