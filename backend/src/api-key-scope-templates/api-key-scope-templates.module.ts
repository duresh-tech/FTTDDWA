import { Module } from '@nestjs/common';
import { ApiKeyScopeTemplatesController } from './api-key-scope-templates.controller';
import { ApiKeyScopeTemplatesSelfController } from './api-key-scope-templates-self.controller';
import { ApiKeyScopeTemplatesService } from './api-key-scope-templates.service';

@Module({
  controllers: [ApiKeyScopeTemplatesController, ApiKeyScopeTemplatesSelfController],
  providers: [ApiKeyScopeTemplatesService],
})
export class ApiKeyScopeTemplatesModule {}
