import { Module } from '@nestjs/common';
import { TenantRtosController } from './tenant-rtos.controller';
import { TenantRtosSelfController } from './tenant-rtos-self.controller';
import { TenantRtosService } from './tenant-rtos.service';

@Module({
  controllers: [TenantRtosController, TenantRtosSelfController],
  providers: [TenantRtosService],
  exports: [TenantRtosService],
})
export class TenantRtosModule {}
