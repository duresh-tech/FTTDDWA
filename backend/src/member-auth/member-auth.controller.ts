import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { MemberAuthService } from './member-auth.service';
import { MemberChangePasswordDto, MemberLoginDto } from './dto/member-auth.dto';
import { MemberSiteService } from '../site/member-site.service';
import { Public } from '../common/decorators/public.decorator';
import { MemberJwtAuthGuard } from '../common/guards/member-jwt-auth.guard';
import { CurrentMember, MemberAuthUser } from '../common/decorators/current-member.decorator';

/**
 * The member portal's own session.
 *
 * `@Public()` here means only "skip the SYSTEM JWT guard" - the API key is
 * still required on every one of these routes, and the guarded ones still
 * demand a member session. Those are the two separate axes `CLAUDE.md` warns
 * about confusing.
 *
 * There is no permissions guard anywhere in this controller: a member holds
 * no RBAC role. Authorisation is structural instead - `me`, `password` and
 * `logout` all act on the member in the token, and no route takes a member id.
 */
@ApiTags('Member / Auth')
@Public()
@Controller('member/auth')
export class MemberAuthController {
  constructor(
    private readonly auth: MemberAuthService,
    private readonly site: MemberSiteService,
  ) {}

  @Post('login')
  // The same budget as the staff login routes.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Member login',
    description:
      'Membership number and password, scoped to the association this ' +
      'HOSTNAME serves - the number is unique per business, not globally. ' +
      'Refused unless the membership is ACTIVE and has a password; a member ' +
      "enrolled by staff has none until one is set.",
  })
  @ApiResponse({ status: 201, description: 'Signed in; tokens and the profile.' })
  @ApiResponse({ status: 401, description: 'Wrong credentials, or the membership is not active.' })
  @ApiResponse({ status: 404, description: 'This hostname serves no member portal.' })
  async login(
    @Req() req: Request,
    @Body() dto: MemberLoginDto,
    @Headers('x-device-type') deviceType: string,
  ) {
    const tenantBusinessId = await this.site.businessIdForRequest(req);
    return this.auth.login(tenantBusinessId, dto, deviceType);
  }

  @Post('refresh')
  @ApiOperation({
    summary: 'Rotate member tokens',
    description:
      'The presented refresh token is revoked as the new pair is issued, so ' +
      'a stolen one is good for a single use and its reuse is detectable.',
  })
  @ApiResponse({ status: 201, description: 'New tokens.' })
  refresh(
    @Body('refreshToken') refreshToken: string,
    @Headers('x-device-type') deviceType: string,
  ) {
    return this.auth.refresh(refreshToken, deviceType);
  }

  @Post('logout')
  @UseGuards(MemberJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Member logout',
    description:
      'Revokes the presented refresh token. Without one, every session for ' +
      'this member is ended rather than leaving them signed in elsewhere.',
  })
  @ApiResponse({ status: 201, description: 'Signed out.', schema: { example: { success: true } } })
  logout(
    @CurrentMember() member: MemberAuthUser,
    @Body('refreshToken') refreshToken?: string,
  ) {
    return this.auth.logout(member.id, refreshToken);
  }

  @Get('me')
  @UseGuards(MemberJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'The signed-in member',
    description:
      'Resolved from the token, never a path parameter - which is what makes ' +
      'it impossible to ask for somebody else. The Aadhaar comes back as its ' +
      'last four digits only, as it does everywhere else.',
  })
  @ApiResponse({ status: 200, description: 'The member.' })
  me(@CurrentMember() member: MemberAuthUser) {
    return this.auth.profile(member.id);
  }

  @Post('password')
  @UseGuards(MemberJwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Change your own password',
    description:
      'Requires the current one. Every other session is ended afterwards, ' +
      'because changing a password is how somebody locks out whoever they ' +
      'think is using their account.',
  })
  @ApiResponse({ status: 201, description: 'Changed.', schema: { example: { success: true } } })
  @ApiResponse({ status: 401, description: 'The current password was wrong.' })
  changePassword(
    @CurrentMember() member: MemberAuthUser,
    @Body() dto: MemberChangePasswordDto,
  ) {
    return this.auth.changePassword(member.id, dto);
  }
}
