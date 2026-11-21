import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, RefreshDto } from './dto/auth.dto';
import { Public } from '../common/decorators/public.decorator';
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import {
  CsrfGuard,
  CSRF_COOKIE,
  REFRESH_COOKIE,
} from '../common/guards/csrf.guard';
import { isAppDevice } from '../common/guards/device-header.guard';


const SANITIZED_USER_EXAMPLE = {
  id: '019f354f-2515-76e3-abc2-1ea12b1aba6e',
  systemCode: 'USR-MR8M8F60-74F8',
  fName: 'System Administrator',
  username: 'admin',
  email: 'admin@system.local',
  roleId: '019f354f-24c8-776a-b92a-b8cb7ac2d576',
  status: 'ACTIVE',
  createdAt: 1783305807,
  updatedAt: 1783305807,
  deletedAt: null,
  role: {
    id: '019f354f-24c8-776a-b92a-b8cb7ac2d576',
    roleKey: 'SYSTEM_SUPER_ADMIN',
    displayName: 'Super Administrator',
  },
};

const LOGIN_RESPONSE_EXAMPLE = {
  user: SANITIZED_USER_EXAMPLE,
  permissions: ['dashboard:view', 'roles:read', 'roles:create', 'roles:update', 'roles:delete'],
  redirectTo: '/system/dashboard',
  accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMTlm...',
  csrfToken: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0',
};

const AUTH_ME_EXAMPLE = {
  id: '019f354f-2515-76e3-abc2-1ea12b1aba6e',
  username: 'admin',
  email: 'admin@system.local',
  roleId: '019f354f-24c8-776a-b92a-b8cb7ac2d576',
  roleKey: 'SYSTEM_SUPER_ADMIN',
  permissions: ['dashboard:view', 'roles:read', 'roles:create', 'roles:update', 'roles:delete'],
};

@ApiTags('System / Auth')
@Controller('system')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'System user login',
    description:
      'Authenticates a system user with username (or email) + password. ' +
      'Returns a JWT access token in the body. For x-device-type=website the ' +
      'refresh and CSRF tokens are set as cookies; for androidApp, iosApp or ' +
      'desktopApp the refresh token is returned in the body instead and no ' +
      'cookies are set. On success a browser client should redirect to ' +
      '`/system/dashboard`.',
  })
  @ApiResponse({
    status: 200,
    description: 'Logged in; access token issued.',
    schema: { example: LOGIN_RESPONSE_EXAMPLE },
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  @ApiResponse({ status: 429, description: 'Too many login attempts.' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const deviceType = (req as any).deviceType;
    const result = await this.authService.login(dto, deviceType);
    const { refreshToken, csrfToken, ...body } = result;

    // Native apps have no cookie jar and no CSRF exposure, so they get the
    // refresh token in the body and store it in Keychain / Keystore. Browsers
    // keep the httpOnly cookie, which keeps the long-lived token unreadable
    // to scripts. docs/guide/mobile-clients.
    if (isAppDevice(deviceType)) return { ...body, refreshToken };

    this.setAuthCookies(res, refreshToken, csrfToken);
    return body;
  }

  @Public()
  @UseGuards(CsrfGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotate tokens',
    description:
      'Rotates the refresh token. Browsers send the httpOnly refresh_token ' +
      'cookie and must include the x-csrf-token header matching the ' +
      'csrf_token cookie; native apps post { refreshToken } in the body, ' +
      'where no cookie exists for CSRF to apply to, and receive the new ' +
      'refresh token in the response body.',
  })
  @ApiResponse({
    status: 200,
    description: 'New token pair issued.',
    schema: {
      example: { accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMTlm...' },
    },
  })
  @ApiResponse({ status: 401, description: 'Refresh token invalid/revoked.' })
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Respond the same way the caller authenticated. Driven by where the
    // token actually came from, NOT by x-device-type: that header is
    // client-supplied, and the CSRF guard keys off the cookie for the same
    // reason.
    const cookieToken = req.cookies?.[REFRESH_COOKIE];
    const token = cookieToken ?? dto?.refreshToken;
    if (!token) {
      throw new UnauthorizedException(
        'No refresh token: send the refresh_token cookie, or refreshToken in the body',
      );
    }

    const tokens = await this.authService.refresh(token, (req as any).deviceType);

    if (!cookieToken) return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };

    this.setAuthCookies(res, tokens.refreshToken, tokens.csrfToken);
    return { accessToken: tokens.accessToken };
  }

  @ApiBearerAuth()
  @UseGuards(CsrfGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Logout',
    description:
      'Revokes the current refresh token (or all of the user\'s tokens when ' +
      'no cookie is present) and clears auth cookies.',
  })
  @ApiResponse({
    status: 200,
    description: 'Logged out.',
    schema: { example: { success: true } },
  })
  async logout(
    @CurrentUser() user: AuthUser,
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookieToken = req.cookies?.[REFRESH_COOKIE];
    await this.authService.logout(user.id, cookieToken ?? dto?.refreshToken);

    // Clearing cookies an app never had is harmless, so this stays
    // unconditional rather than branching on the device type.
    res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/system' });
    res.clearCookie(CSRF_COOKIE, { path: '/' });
    return { success: true };
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({
    summary: 'Current user',
    description:
      'Returns the authenticated system user with role and resolved permissions.',
  })
  @ApiResponse({
    status: 200,
    description: 'Authenticated user profile.',
    schema: { example: AUTH_ME_EXAMPLE },
  })
  @ApiResponse({ status: 401, description: 'Missing/invalid access token.' })
  me(@CurrentUser() user: AuthUser) {
    return user;
  }

  private setAuthCookies(res: Response, refreshToken: string, csrfToken: string) {
    const secure = this.config.get('COOKIE_SECURE') === 'true';
    // httpOnly refresh token, scoped to the system API only
    res.cookie(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'strict',
      path: '/api/v1/system',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    // readable CSRF token for the double-submit pattern
    res.cookie(CSRF_COOKIE, csrfToken, {
      httpOnly: false,
      secure,
      sameSite: 'strict',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }
}
