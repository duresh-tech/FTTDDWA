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
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { TenantAuthService } from './tenant-auth.service';
import { TenantLoginDto, TenantRefreshDto } from './dto/tenant-auth.dto';
import { Public } from '../common/decorators/public.decorator';
import {
  CurrentTenantUser,
  TenantAuthUser,
} from '../common/decorators/current-tenant-user.decorator';
import { TenantJwtAuthGuard } from '../common/guards/tenant-jwt-auth.guard';
import {
  TenantCsrfGuard,
  TENANT_CSRF_COOKIE,
  TENANT_REFRESH_COOKIE,
} from '../common/guards/tenant-csrf.guard';
import { isAppDevice } from '../common/guards/device-header.guard';


const SANITIZED_TENANT_USER_EXAMPLE = {
  id: '019f37c9-c7d3-71df-8718-0c4e34a03426',
  systemCode: 'TNU-MR9AZVF7-8954',
  fName: 'John Doe',
  username: 'john.doe',
  email: 'john@example.com',
  roleId: '019f37c9-aaaa-71df-8718-0c4e34a03426',
  status: 'ACTIVE',
  createdAt: 1783305807,
  updatedAt: 1783305807,
  deletedAt: null,
  role: {
    id: '019f37c9-aaaa-71df-8718-0c4e34a03426',
    roleKey: 'TENANT_ADMIN',
    displayName: 'Tenant Administrator',
  },
};

const TENANT_LOGIN_RESPONSE_EXAMPLE = {
  user: SANITIZED_TENANT_USER_EXAMPLE,
  permissions: ['tenant-dashboard:view'],
  redirectTo: '/tenant/dashboard',
  accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMTlm...',
  csrfToken: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0',
};

const TENANT_ME_EXAMPLE = {
  id: '019f37c9-c7d3-71df-8718-0c4e34a03426',
  username: 'john.doe',
  email: 'john@example.com',
  roleId: '019f37c9-aaaa-71df-8718-0c4e34a03426',
  roleKey: 'TENANT_ADMIN',
  permissions: ['tenant-dashboard:view'],
};

@ApiTags('Tenant / Auth')
@Controller('tenant')
export class TenantAuthController {
  constructor(
    private readonly tenantAuthService: TenantAuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Tenant user login',
    description:
      'Authenticates a tenant user with username (or email) + password. The ' +
      "user's role must have visibleToTenants=true. Returns a JWT access " +
      'token in the body; the refresh token and CSRF token are set as ' +
      'cookies. On success the client should redirect to `/tenant/dashboard`.',
  })
  @ApiResponse({
    status: 200,
    description: 'Logged in; access token issued.',
    schema: { example: TENANT_LOGIN_RESPONSE_EXAMPLE },
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials, inactive account, or role not tenant-visible.' })
  @ApiResponse({ status: 429, description: 'Too many login attempts.' })
  async login(
    @Body() dto: TenantLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const deviceType = (req as any).deviceType;
    const result = await this.tenantAuthService.login(dto, deviceType);
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
  @UseGuards(TenantCsrfGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotate tenant tokens',
    description:
      'Rotates the refresh token. Browsers send the httpOnly ' +
      'tenant_refresh_token cookie and must include the x-csrf-token header ' +
      'matching the tenant_csrf_token cookie; native apps post ' +
      '{ refreshToken } in the body, where no cookie exists for CSRF to ' +
      'apply to, and receive the new refresh token in the response body.',
  })
  @ApiResponse({
    status: 200,
    description: 'New token pair issued.',
    schema: { example: { accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMTlm...' } },
  })
  @ApiResponse({ status: 401, description: 'Refresh token invalid/revoked.' })
  async refresh(
    @Body() dto: TenantRefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Respond the same way the caller authenticated. Driven by where the
    // token actually came from, NOT by x-device-type: that header is
    // client-supplied, and the CSRF guard keys off the cookie for the same
    // reason.
    const cookieToken = req.cookies?.[TENANT_REFRESH_COOKIE];
    const token = cookieToken ?? dto?.refreshToken;
    if (!token) {
      throw new UnauthorizedException(
        'No refresh token: send the tenant_refresh_token cookie, or refreshToken in the body',
      );
    }

    const tokens = await this.tenantAuthService.refresh(token, (req as any).deviceType);

    if (!cookieToken) return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };

    this.setAuthCookies(res, tokens.refreshToken, tokens.csrfToken);
    return { accessToken: tokens.accessToken };
  }

  @Public()
  @UseGuards(TenantJwtAuthGuard, TenantCsrfGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Tenant logout',
    description:
      "Revokes the current refresh token (or all of the user's tokens when " +
      'no cookie is present) and clears tenant auth cookies.',
  })
  @ApiResponse({
    status: 200,
    description: 'Logged out.',
    schema: { example: { success: true } },
  })
  async logout(
    @CurrentTenantUser() user: TenantAuthUser,
    @Body() dto: TenantRefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookieToken = req.cookies?.[TENANT_REFRESH_COOKIE];
    await this.tenantAuthService.logout(user.id, cookieToken ?? dto?.refreshToken);

    // Clearing cookies an app never had is harmless, so this stays
    // unconditional rather than branching on the device type.
    res.clearCookie(TENANT_REFRESH_COOKIE, { path: '/api/v1/tenant' });
    res.clearCookie(TENANT_CSRF_COOKIE, { path: '/' });
    return { success: true };
  }

  @Public()
  @UseGuards(TenantJwtAuthGuard)
  @Get('me')
  @ApiOperation({
    summary: 'Current tenant user',
    description: 'Returns the authenticated tenant user with role and resolved permissions.',
  })
  @ApiResponse({
    status: 200,
    description: 'Authenticated tenant user profile.',
    schema: { example: TENANT_ME_EXAMPLE },
  })
  @ApiResponse({ status: 401, description: 'Missing/invalid access token.' })
  me(@CurrentTenantUser() user: TenantAuthUser) {
    return user;
  }

  private setAuthCookies(res: Response, refreshToken: string, csrfToken: string) {
    const secure = this.config.get('COOKIE_SECURE') === 'true';
    res.cookie(TENANT_REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'strict',
      path: '/api/v1/tenant',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.cookie(TENANT_CSRF_COOKIE, csrfToken, {
      httpOnly: false,
      secure,
      sameSite: 'strict',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }
}
