import { Global, Module } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeysSelfController } from './api-keys-self.controller';
import { ApiKeysService } from './api-keys.service';

/**
 * Global on purpose: ApiKeyGuard is registered as an APP_GUARD, so Nest must
 * be able to resolve ApiKeysService from the root injector rather than only
 * inside modules that import this one.
 */
@Global()
@Module({
  controllers: [ApiKeysController, ApiKeysSelfController],
  providers: [ApiKeysService, ApiKeyGuard],
  exports: [ApiKeysService, ApiKeyGuard],
})
export class ApiKeysModule {}
