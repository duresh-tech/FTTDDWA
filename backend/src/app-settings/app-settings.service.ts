import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { newId, now } from '../common/utils/id.util';
import { RESERVED_APP_SETTING_KEYS } from '../common/constants/permissions';
import { listResponse, paginate } from '../common/dto/query.dto';
import { CreateAppSettingDto, UpdateAppSettingDto, validateValueForDataType } from './dto/app-settings.dto';
import { AppSettingListQueryDto } from './dto/app-settings-query.dto';

const APP_LOGO_KEY = 'app.logo_path';
const APP_NAME_KEY = 'app.name';
const DEFAULT_APP_NAME = 'FTTDDWA';
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024; // 5 MB
const UPLOADS_FOLDER = 'app_settings_uploads';

@Injectable()
export class AppSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Reserved rows are machine-written credentials, not settings.
   *
   * `console.api_key` holds the console's own live API key: listing it would
   * put a credential on screen, and editing it through a text box would lock
   * the console out of the API. It has no UI for exactly that reason.
   */
  private assertNotReserved(key: string) {
    if (RESERVED_APP_SETTING_KEYS.includes(key)) {
      throw new ForbiddenException(
        `"${key}" is managed by the system and cannot be changed here.`,
      );
    }
  }

  async findAll(query: AppSettingListQueryDto) {
    const { page, limit, search, status, dataType, sortBy, sortOrder } = query;
    const where = {
      status: status ? status : ({ not: 'DELETED' } as const),
      // Machine-written credentials, not settings - see assertNotReserved().
      key: { notIn: RESERVED_APP_SETTING_KEYS },
      ...(dataType ? { dataType } : {}),
      ...(search
        ? {
            OR: [{ key: { contains: search, mode: 'insensitive' as const } }, { description: { contains: search, mode: 'insensitive' as const } }],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.appSetting.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        ...paginate(page, limit),
      }),
      this.prisma.appSetting.count({ where }),
    ]);
    return listResponse(items, total, page, limit);
  }

  async findOne(id: string) {
    const setting = await this.prisma.appSetting.findFirst({
      where: { id, status: { not: 'DELETED' }, key: { notIn: RESERVED_APP_SETTING_KEYS } },
    });
    if (!setting) throw new NotFoundException('App setting not found');
    return setting;
  }

  async findByKey(key: string) {
    this.assertNotReserved(key);
    const setting = await this.prisma.appSetting.findFirst({ where: { key, status: { not: 'DELETED' } } });
    if (!setting) throw new NotFoundException('App setting not found');
    return setting;
  }

  async create(dto: CreateAppSettingDto) {
    this.assertNotReserved(dto.key);
    const existing = await this.prisma.appSetting.findUnique({ where: { key: dto.key } });
    if (existing) throw new BadRequestException(`Key "${dto.key}" is already in use`);

    const timestamp = now();
    return this.prisma.appSetting.create({
      data: {
        id: newId(),
        key: dto.key,
        dataType: dto.dataType,
        value: dto.value,
        description: dto.description,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    });
  }

  async update(id: string, dto: UpdateAppSettingDto) {
    const setting = await this.findOne(id);
    if (dto.value !== undefined) {
      const error = validateValueForDataType(setting.dataType, dto.value);
      if (error) throw new BadRequestException(error);
    }
    return this.prisma.appSetting.update({
      where: { id },
      data: { ...dto, updatedAt: now() },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    const timestamp = now();
    await this.prisma.appSetting.update({
      where: { id },
      data: { status: 'DELETED', deletedAt: timestamp, updatedAt: timestamp },
    });
    return { success: true };
  }

  async restore(id: string) {
    const setting = await this.prisma.appSetting.findFirst({ where: { id, status: 'DELETED' } });
    if (!setting) throw new NotFoundException('App setting not found or not deleted');
    return this.prisma.appSetting.update({
      where: { id },
      data: { status: 'ACTIVE', deletedAt: null, updatedAt: now() },
    });
  }

  /**
   * Public branding. The DB `app.name` row wins, with the APP_NAME env var as
   * the fallback.
   *
   * This used to read APP_NAME unconditionally and ignore the DB row, which
   * made the app name a deploy-time-only setting. The first-run setup wizard
   * and the App Settings admin page both write `app.name`, so reading env
   * first would make both of them write-only -- you could change the name and
   * nothing would ever show it.
   */
  async getBrandingPublic() {
    const [nameRow, logoRow] = await Promise.all([
      this.prisma.appSetting.findFirst({ where: { key: APP_NAME_KEY, status: 'ACTIVE' } }),
      this.prisma.appSetting.findFirst({ where: { key: APP_LOGO_KEY, status: 'ACTIVE' } }),
    ]);
    return {
      appName:
        nameRow?.value?.trim() ||
        this.config.get<string>('APP_NAME', DEFAULT_APP_NAME),
      logoPath: logoRow?.value || null,
    };
  }

  async uploadLogoValue(file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    if (file.size > MAX_UPLOAD_SIZE) throw new BadRequestException('File exceeds the 5 MB limit');
    if (!file.mimetype.startsWith('image/')) throw new BadRequestException('File must be an image');

    const existing = await this.prisma.appSetting.findUnique({ where: { key: APP_LOGO_KEY } });
    const path = await this.storage.upload(file, UPLOADS_FOLDER);
    if (existing?.value) {
      await this.storage.remove(existing.value).catch(() => undefined);
    }

    const timestamp = now();
    if (existing) {
      await this.prisma.appSetting.update({
        where: { key: APP_LOGO_KEY },
        data: { value: path, status: 'ACTIVE', deletedAt: null, updatedAt: timestamp },
      });
    } else {
      await this.prisma.appSetting.create({
        data: {
          id: newId(),
          key: APP_LOGO_KEY,
          dataType: 'STRING',
          value: path,
          description: 'Path to the application logo',
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      });
    }
    return { path };
  }

  /** Generic upload for any FILE-dataType setting's value - just stores the
   * file and returns its path; the caller decides which key it belongs to
   * via the normal create/update body, same as the tenant-customers flow. */
  async uploadValueFile(file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    if (file.size > MAX_UPLOAD_SIZE) throw new BadRequestException('File exceeds the 5 MB limit');
    const path = await this.storage.upload(file, UPLOADS_FOLDER);
    return { path };
  }
}
