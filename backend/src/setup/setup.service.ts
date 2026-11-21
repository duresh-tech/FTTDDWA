import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService, UploadedFileLike } from '../storage/storage.service';
import {
  AlreadyInitializedError,
  bootstrapInstance,
  consoleKeyToken,
  isInitialized,
} from '../common/bootstrap/bootstrap';
import { APP_LOGO_PATH_KEY, APP_NAME_KEY } from '../common/constants/permissions';
import { InitializeSetupDto } from './dto/setup.dto';

const MAX_LOGO_SIZE = 5 * 1024 * 1024; // 5 MB, same ceiling as App Settings uploads
const LOGO_FOLDER = 'app_settings_uploads';

@Injectable()
export class SetupService {
  private readonly logger = new Logger(SetupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Whether first-run setup is still available.
   *
   * Keyed on "does a system user exist", not on a flag row: the App Settings
   * store is editable through the admin UI, so a flag there could be deleted
   * to re-open the installer.
   */
  async status() {
    const initialized = await isInitialized(this.prisma);

    const [nameRow, logoRow, consoleApiKey] = await Promise.all([
      this.prisma.appSetting.findFirst({ where: { key: APP_NAME_KEY, status: 'ACTIVE' } }),
      this.prisma.appSetting.findFirst({ where: { key: APP_LOGO_PATH_KEY, status: 'ACTIVE' } }),
      // Only once initialized. Before that the console talks exclusively to
      // the setup routes, which need no key, so there is nothing to serve and
      // no reason for an uninitialized instance to hand anything out.
      initialized ? consoleKeyToken(this.prisma) : Promise.resolve(null),
    ]);

    return {
      initialized,
      appName:
        nameRow?.value?.trim() || this.config.get<string>('APP_NAME', 'FTTDDWA'),
      logoPath: logoRow?.value || null,
      /**
       * The console's own API key.
       *
       * Served unauthenticated on purpose: the console is a public web app
       * and cannot hold a secret the browser does not see. A key states which
       * APPLICATION is calling - every console route still requires a session
       * and the permissions behind it, so holding this grants nothing on its
       * own.
       *
       * Null when there is no usable key. The console then shows what to do:
       * `npm run console-key`.
       */
      consoleApiKey,
    };
  }

  private async assertNotInitialized() {
    if (await isInitialized(this.prisma)) {
      throw new ConflictException(
        'This instance is already initialized. Sign in instead.',
      );
    }
  }

  /**
   * Accept a branding logo before any account exists.
   *
   * The normal upload endpoints require authentication, which the wizard
   * cannot satisfy yet. This one is public but permanently 409s once the
   * instance is initialized, so the window is bounded to first-run. Worst
   * case within that window is an abandoned upload left on disk, capped by
   * the size limit and the route throttle.
   */
  async uploadLogo(file?: UploadedFileLike) {
    await this.assertNotInitialized();

    if (!file) throw new BadRequestException('No file provided');
    if (file.size > MAX_LOGO_SIZE) {
      throw new BadRequestException('File exceeds the 5 MB limit');
    }
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('File must be an image');
    }

    const path = await this.storage.upload(file, LOGO_FOLDER);
    return { path };
  }

  /**
   * Create the SYSTEM_SUPER_ADMIN role with every permission, the first admin
   * account, and the initial branding -- in one transaction, so a failure
   * never leaves a half-initialized instance behind.
   */
  async initialize(dto: InitializeSetupDto) {
    await this.assertNotInitialized();

    // Outside the transaction on purpose: argon2id can take ~1s on a
    // cpu-limited container, which is long enough to threaten the
    // transaction timeout.
    const passwordHash = await argon2.hash(dto.admin.password, {
      type: argon2.argon2id,
    });

    try {
      const result = await this.prisma.$transaction(
        (tx) =>
          bootstrapInstance(tx, {
            admin: {
              fName: dto.admin.fName,
              username: dto.admin.username,
              email: dto.admin.email,
              passwordHash,
            },
            appName: dto.branding.appName,
            logoPath: dto.branding.logoPath ?? null,
            createTenantRole: dto.createTenantRole,
          }),
        { timeout: 20_000 },
      );

      this.logger.log(
        `Instance initialized: user "${result.username}" with role ${result.roleKey} ` +
          `(${result.permissionCount} permissions)` +
          (result.tenantRoleCreated ? ' + TENANT_ADMIN' : '') +
          `, console key ${result.consoleKeyPrefix}`,
      );

      return {
        user: {
          id: result.userId,
          username: result.username,
          email: result.email,
        },
        roleKey: result.roleKey,
        permissionCount: result.permissionCount,
        tenantRoleCreated: result.tenantRoleCreated,
      };
    } catch (error) {
      // Raced with a concurrent initialize; the transaction re-checked and bailed.
      if (error instanceof AlreadyInitializedError) {
        throw new ConflictException(
          'This instance is already initialized. Sign in instead.',
        );
      }
      throw error;
    }
  }
}
