import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { SkipApiKey } from '../common/decorators/skip-api-key.decorator';
import { MemberSiteService } from './member-site.service';
import { TenantMemberApplicationsService } from '../tenant-member-applications/tenant-member-applications.service';
import { SubmitMemberApplicationDto } from '../tenant-member-applications/dto/member-application.dto';

/**
 * What an association's own domain serves before anyone has signed in: its
 * public details, the lookups a registration form needs, and the form itself.
 *
 * **The business always comes from the hostname**, never the request body.
 * This is the only place in the system an unauthenticated caller can write,
 * and letting them name the association would let anyone file an application
 * against any of them. On the system console there is no association, so every
 * route here 404s and the member portal simply does not exist on that host.
 *
 * `CLAUDE.md` warns against adding an unauthenticated account-creation route,
 * because `POST /system/register` was exactly that and was never closed. This
 * is not one: it writes to `tenant_member_applications`, grants no permission,
 * issues no session, and produces no member until staff approve it.
 *
 * @SkipApiKey for the same reason the sibling site routes have it: these are
 * reached by a browser that has not loaded the console and has no key.
 */
@ApiTags('Public / Member')
@Public()
@SkipApiKey()
@Controller('public/member')
export class MemberSiteController {
  constructor(
    private readonly site: MemberSiteService,
    private readonly applications: TenantMemberApplicationsService,
  ) {}

  @Get('site')
  // The home page calls this on every load, so it must not eat the per-IP
  // budget - the same reasoning as `public/site/resolve`.
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({
    summary: "The association's public details",
    description:
      'An allow-listed subset of the Association settings, plus whether ' +
      'registration is open. The settings store also holds things a business ' +
      'did not publish, so this is a list rather than the whole map.',
  })
  @ApiOkResponse({
    schema: {
      example: {
        association: {
          'association.name': 'FEDERATION OF TAMILNADU TENT DEALERS …',
          'association.nameTamil': 'தமிழ்நாடு கூடாரம் அலங்கார நலச்சங்கம்',
          'association.shortName': 'FTTDDWA',
        },
        registrationOpen: true,
      },
    },
  })
  @ApiResponse({ status: 404, description: 'This hostname serves no member portal.' })
  publicSite(@Req() req: Request) {
    return this.site.publicSite(req);
  }

  @Get('options')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary: 'The lookups the registration form needs',
    description:
      'Positions, industries and the geography chain for this association, ' +
      'ACTIVE only. Districts, taluks and RTOs carry their parent id so the ' +
      'form can cascade without asking again on every change.',
  })
  @ApiResponse({ status: 404, description: 'This hostname serves no member portal.' })
  publicOptions(@Req() req: Request) {
    return this.site.publicOptions(req);
  }

  @Post('apply')
  // Throttled like every other credential endpoint here. This one creates a
  // record and hashes a password, so it is both the expensive route and the
  // one worth flooding.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Submit a membership application',
    description:
      'Files against the association this HOSTNAME serves. Refused when that ' +
      'association has registration turned off. Creates no member and no ' +
      'session - only staff approval does that. The response carries the ' +
      'application number and nothing else: an anonymous caller gets no echo ' +
      'of what was submitted.',
  })
  @ApiResponse({
    status: 201,
    description: 'Application filed.',
    schema: { example: { applicationNumber: '000001', status: 'PENDING', submittedAt: 1783308735 } },
  })
  @ApiResponse({ status: 400, description: 'Already a member, already applied, or a broken chain.' })
  @ApiResponse({ status: 403, description: 'This association is not accepting registrations.' })
  async apply(@Req() req: Request, @Body() dto: SubmitMemberApplicationDto) {
    const tenantBusinessId = await this.site.businessIdForRequest(req);
    return this.applications.submit(tenantBusinessId, dto);
  }
}
