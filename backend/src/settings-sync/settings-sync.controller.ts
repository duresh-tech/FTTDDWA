import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SettingsSyncService } from './settings-sync.service';
import { SyncSettingsDto } from './dto/sync-settings.dto';
import { SyncLogListQueryDto } from './dto/sync-log-query.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

@ApiTags('System / Settings Sync')
@ApiBearerAuth()
@Controller('system/settings-sync')
export class SettingsSyncController {
  constructor(private readonly settingsSyncService: SettingsSyncService) {}

  @Post()
  @RequirePermissions('settings-sync:run')
  @ApiOperation({
    summary: 'Backfill setting definitions to businesses that already exist',
    description:
      'A business created after a definition already has it. This gives it to ' +
      'the ones created before. Only missing rows are inserted - an existing ' +
      'value is never overwritten, so the command is safe to re-run and is ' +
      're-run by every seed. Pass dryRun to see what would change.',
  })
  @ApiResponse({
    status: 201,
    description: 'What the run did.',
    schema: {
      example: {
        dryRun: false,
        businessesProcessed: 3,
        inserted: 8,
        skipped: 16,
        failed: 0,
      },
    },
  })
  run(@Body() dto: SyncSettingsDto, @CurrentUser() user: AuthUser) {
    return this.settingsSyncService.sync(dto, user.id);
  }

  @Get('logs')
  @RequirePermissions('settings-sync:run')
  @ApiOperation({
    summary: 'What past sync runs did',
    description:
      'One row per definition per business per run, including the ones it ' +
      'skipped - so "nothing happened" is distinguishable from "it never ran".',
  })
  @ApiResponse({ status: 200, description: 'Paginated sync log.' })
  logs(@Query() query: SyncLogListQueryDto) {
    return this.settingsSyncService.findSyncLogs(query);
  }
}
