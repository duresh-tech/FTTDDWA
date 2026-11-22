import { Module } from '@nestjs/common';
import { TenantAssociationPositionsController } from './tenant-association-positions.controller';
import { TenantAssociationPositionsSelfController } from './tenant-association-positions-self.controller';
import { TenantAssociationPositionsService } from './tenant-association-positions.service';

@Module({
  controllers: [
    TenantAssociationPositionsController,
    TenantAssociationPositionsSelfController,
  ],
  providers: [TenantAssociationPositionsService],
  exports: [TenantAssociationPositionsService],
})
export class TenantAssociationPositionsModule {}
