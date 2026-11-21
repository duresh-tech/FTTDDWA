import { Body, Controller, Get, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { UploadedFileLike } from '../storage/storage.service';
import { SetupService } from './setup.service';
import { InitializeSetupDto } from './dto/setup.dto';
import { SkipApiKey } from '../common/decorators/skip-api-key.decorator';

/**
 * First-run installer.
 *
 * Every route here is public, because by definition no account exists yet.
 * They stop working permanently (409) the moment a system user exists, so the
 * window is limited to a genuinely uninitialized instance.
 *
 * This replaces the old `@Public() POST /system/register` endpoint, which made
 * whoever registered first a super admin and stayed open forever.
 */
@ApiTags('System / Setup')
// Bootstrap: the instance has no database rows yet, so no key can
// possibly exist. These routes close themselves permanently once a system
// user does exist, which bounds the exposure to first-run.
@SkipApiKey()
@Controller('system/setup')
export class SetupController {
  constructor(private readonly setupService: SetupService) {}

  @Get('status')
  @Public()
  // The console polls this on every entry point to decide whether to redirect
  // to /setup, so it needs a far more generous budget than the writes below.
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Whether this instance still needs first-run setup',
    description:
      'Also doubles as a database-reachability signal for the setup wizard, ' +
      'since answering it requires a successful query.',
  })
  @ApiOkResponse({
    schema: {
      example: {
        initialized: false,
        appName: 'FTTDDWA',
        logoPath: null,
        consoleApiKey: null,
      },
    },
  })
  async status() {
    return this.setupService.status();
  }

  @Post('logo')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiOperation({
    summary: 'Upload a branding logo during first-run setup',
    description:
      'Returns the storage path to pass back as branding.logoPath. Images ' +
      'only, 5 MB maximum. Unavailable once the instance is initialized.',
  })
  @ApiCreatedResponse({ schema: { example: { path: 'app_settings_uploads/019f3d95-....png' } } })
  @ApiConflictResponse({ description: 'This instance is already initialized.' })
  async uploadLogo(@UploadedFile() file?: UploadedFileLike) {
    return this.setupService.uploadLogo(file);
  }

  @Post('initialize')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Initialize the instance',
    description:
      'Creates the SYSTEM_SUPER_ADMIN role holding every permission, the ' +
      'first administrator account, and the initial branding -- atomically, ' +
      'so a failure cannot leave a half-initialized instance. Optionally also ' +
      'creates a tenant-visible role so the tenant portal works immediately.',
  })
  @ApiCreatedResponse({
    schema: {
      example: {
        user: {
          id: '019f357b-e5b1-73aa-9062-adc0f927a584',
          username: 'jane.doe',
          email: 'jane@example.com',
        },
        roleKey: 'SYSTEM_SUPER_ADMIN',
        permissionCount: 86,
        tenantRoleCreated: true,
      },
    },
  })
  @ApiConflictResponse({ description: 'This instance is already initialized.' })
  async initialize(@Body() dto: InitializeSetupDto) {
    return this.setupService.initialize(dto);
  }
}
