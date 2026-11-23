import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TenantIdCardsService } from './tenant-id-cards.service';
import { sendPdf } from './tenant-id-cards.controller';
import { Public } from '../common/decorators/public.decorator';
import { MemberJwtAuthGuard } from '../common/guards/member-jwt-auth.guard';
import { CurrentMember, MemberAuthUser } from '../common/decorators/current-member.decorator';

/**
 * A member's own membership card.
 *
 * Both routes resolve the card FROM THE TOKEN's member - neither takes a card
 * id or a member id, so there is no identifier to tamper with and no shape of
 * request that reads somebody else's card. That is the whole authorisation
 * model here, since a member holds no RBAC role to check.
 *
 * Only the ACTIVE card is reachable. A superseded or revoked one stays in the
 * history for staff, but it is not something the member is entitled to hold.
 */
@ApiTags('Member / ID Card')
@ApiBearerAuth()
@Public()
@UseGuards(MemberJwtAuthGuard)
@Controller('member/id-card')
export class MemberIdCardController {
  constructor(private readonly service: TenantIdCardsService) {}

  @Get()
  @ApiOperation({
    summary: 'Your current membership card, or null',
    description:
      'Null when none has been issued yet - a member cannot issue their own, ' +
      'so this is information rather than an error. `expired` is computed ' +
      'from the date and the clock, never stored.',
  })
  @ApiResponse({
    status: 200,
    description: 'The card, or null.',
    schema: {
      example: {
        id: '019f357b-e5b1-73aa-9062-adc0f927a584',
        systemCode: 'MIC-MR8NZ6OO-1-7B2D',
        issueNumber: 2,
        issuedAt: 1783308735,
        expiryAt: 1940988735,
        status: 'ACTIVE',
        fileSizeBytes: 24177,
        expired: false,
      },
    },
  })
  current(@CurrentMember() member: MemberAuthUser) {
    return this.service.findCurrentForMember(member.id);
  }

  @Get('download')
  @ApiProduces('application/pdf')
  @ApiOperation({
    summary: 'Download your current membership card',
    description:
      'Streams from private storage, which nothing serves statically and the ' +
      'gateway does not proxy - so this check is not something a direct URL ' +
      'can step around.',
  })
  @ApiResponse({ status: 200, description: 'The PDF.' })
  @ApiResponse({ status: 404, description: 'No card has been issued to you yet.' })
  async download(@CurrentMember() member: MemberAuthUser, @Res() res: Response) {
    const { buffer, filename } = await this.service.readOwnCardFile(member.id);
    sendPdf(res, buffer, filename);
  }
}
